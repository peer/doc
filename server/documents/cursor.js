import {Match} from 'meteor/check';
import {Meteor} from 'meteor/meteor';
import {_} from 'meteor/underscore';

import randomColor from 'randomcolor';

import {Cursor} from '/lib/documents/cursor';
import {User} from '/lib/documents/user';
import {Document} from '/lib/documents/document';
import {check} from '/server/check';

const UPDATE_ACTIVE_CURSORS_INTERVAL = 60 * 1000; // ms
// INACTIVE_CURSORS_TIMEOUT should be larger than UPDATE_ACTIVE_CURSORS_INTERVAL.
const INACTIVE_CURSORS_TIMEOUT = UPDATE_ACTIVE_CURSORS_INTERVAL + 30 * 1000; // ms

Cursor._delete = function delete_(args, connectionId) {
  check(args, {
    contentKey: Match.DocumentId,
    clientId: Match.DocumentId,
  });

  // We do not check permissions because we assume that if user had permission to insert the
  // cursor in the first place (because document exist), they have permissions also to remove it.
  // We do this because permission check would otherwise fail when user has just logged out,
  // but called "Cursor.remove" to cleanup the cursor. We assure nobody else can remove the
  // cursor document because we limit the query based on connection ID.

  return this.documents.remove({
    connectionId,
    contentKey: args.contentKey,
    clientId: args.clientId,
  });
};

Cursor._update = function update(args, user, connectionId) {
  check(args, {
    contentKey: Match.DocumentId,
    clientId: Match.DocumentId,
    head: Match.NonNegativeInteger,
    ranges: [{beginning: Match.NonNegativeInteger, end: Match.NonNegativeInteger}],
  });

  // We check that the user has permissions on cursor's document.
  if (!user || !Document.existsAndCanUser({contentKey: args.contentKey}, [Document.PERMISSIONS.VIEW, Document.PERMISSIONS.UPDATE, Document.PERMISSIONS.COMMENT_CREATE], user)) {
    throw new Meteor.Error('not-found', "Document cannot be found.");
  }

  const timestamp = new Date();

  return this.documents.update({
    connectionId,
    contentKey: args.contentKey,
    clientId: args.clientId,
  }, {
    $set: {
      head: args.head,
      ranges: args.ranges,
      updatedAt: timestamp,
    },
    $setOnInsert: {
      createdAt: timestamp,
      author: user.getReference(),
      color: randomColor(),
    },
  }, {
    upsert: true,
  });
};

Meteor.methods({
  'Cursor.delete'(args) {
    return Cursor._delete(args, (this.connection && this.connection.id) || null);
  },

  'Cursor.update'(args) {
    const user = Meteor.user(_.extend(User.REFERENCE_FIELDS(), User.CHECK_PERMISSIONS_FIELDS()));

    return Cursor._update(args, user, (this.connection && this.connection.id) || null);
  },
});

// TODO: Publish only cursors which are not for the current connection.
Meteor.publish('Cursor.list', function cursorList(args) {
  check(args, {
    contentKey: Match.DocumentId,
  });

  this.enableScope();

  this.autorun((computation) => {
    // We check that the user has permissions on cursor's document.
    if (!Document.existsAndCanUser({contentKey: args.contentKey}, Document.PERMISSIONS.VIEW)) {
      return [];
    }

    return Cursor.documents.find({
      contentKey: args.contentKey,
    }, {
      fields: Cursor.PUBLISH_FIELDS(),
    });
  });
});

const connectionIds = new Set();

Meteor.onConnection((connection) => {
  connectionIds.add(connection.id);

  connection.onClose(() => {
    Cursor.documents.remove({
      connectionId: connection.id,
    });
    connectionIds.delete(connection.id);
  });
});

// Every UPDATE_ACTIVE_CURSORS_INTERVAL we update cursor documents for all active
// connections. We also remove any documents which have not been updated (by moving
// the cursor or by being part of an active connection) in INACTIVE_CURSORS_TIMEOUT.
Meteor.setInterval(() => {
  const currentTime = new Date();

  Cursor.documents.update({
    connectionId: {
      $in: Array.from(connectionIds.keys()),
    },
    updatedAt: {
      $lt: currentTime,
    },
  }, {
    $set: {
      updatedAt: currentTime,
    },
  }, {multi: true});

  const expirationTime = new Date();
  expirationTime.setTime(currentTime.getTime() - INACTIVE_CURSORS_TIMEOUT);
  Cursor.documents.remove({
    updatedAt: {
      $lt: expirationTime,
    },
  });
}, UPDATE_ACTIVE_CURSORS_INTERVAL);
