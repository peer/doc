import {check, Match} from 'meteor/check';
import {Meteor} from 'meteor/meteor';
import {_} from 'meteor/underscore';

import randomColor from 'randomcolor';

import {Cursor} from '/lib/documents/cursor';
import {User} from '/lib/documents/user';
import {Document} from '/lib/documents/document';

// Server-side only methods, so we are not using ValidatedMethod.
Meteor.methods({
  'Cursor.remove'(args) {
    check(args, {
      contentKey: Match.DocumentId,
      clientId: Match.DocumentId,
    });

    // We check that the user has permissions on cursor's document.
    if (!Document.existsAndCanUser({contentKey: args.contentKey}, [Document.PERMISSIONS.UPDATE, Document.PERMISSIONS.COMMENT_CREATE])) {
      throw new Meteor.Error('not-found', "Document cannot be found.");
    }

    Cursor.documents.remove({
      contentKey: args.contentKey,
      clientId: args.clientId,
      connectionId: this.connection.id,
    });
  },

  'Cursor.update'(args) {
    check(args, {
      contentKey: Match.DocumentId,
      clientId: Match.DocumentId,
      head: Match.NonNegativeInteger,
      ranges: [{beginning: Match.NonNegativeInteger, end: Match.NonNegativeInteger}],
    });

    const user = Meteor.user(_.extend(User.REFERENCE_FIELDS(), User.CHECK_PERMISSIONS_FIELDS()));

    // We check that the user has permissions on cursor's document.
    if (!user || !Document.existsAndCanUser({contentKey: args.contentKey}, [Document.PERMISSIONS.VIEW, Document.PERMISSIONS.UPDATE, Document.PERMISSIONS.COMMENT_CREATE], user)) {
      throw new Meteor.Error('not-found', "Document cannot be found.");
    }

    const timestamp = new Date();

    Cursor.documents.update({
      contentKey: args.contentKey,
      clientId: args.clientId,
      connectionId: this.connection.id,
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

const connectionsCleanup = Meteor.bindEnvironment(() => {
  for (const connectionId of connectionIds) {
    Cursor.documents.remove({
      connectionId,
    });
    connectionIds.delete(connectionId);
  }
});

process.once('exit', connectionsCleanup);
process.once('SIGTERM', connectionsCleanup);
process.once('SIGINT', connectionsCleanup);

// For testing.
export {Cursor};
