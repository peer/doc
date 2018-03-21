import {check, Match} from 'meteor/check';
import {Meteor} from 'meteor/meteor';

import {Cursor} from '/lib/cursor';
import {User} from '/lib/user';
import randomColor from 'randomcolor';

// Server-side only method, so we are not using ValidatedMethod.
Meteor.methods({

  'Cursor.remove'(args) {
    check(args, {
      contentKey: Match.DocumentId,
      clientId: Match.DocumentId,
    });
    Cursor.documents.remove({
      contentKey: args.contentKey,
      clientId: args.clientId,
    });
  },

  'Cursor.update'(args) {
    check(args, {
      contentKey: Match.DocumentId,
      clientId: Match.DocumentId,
      head: Match.Integer,
      ranges: [{beginning: Match.Integer, end: Match.Integer}],
    });

    const user = Meteor.user(User.REFERENCE_FIELDS());
    if (!user) {
      throw new Meteor.Error('unauthorized', "Unauthorized.");
    }

    // TODO: Check more permissions?

    Cursor.documents.update(
      {
        contentKey: args.contentKey,
        clientId: args.clientId,
        connectionId: this.connection.id,
      },
      {
        $set: {
          head: args.head,
          ranges: args.ranges,
        },
        $setOnInsert: {
          createdAt: new Date(),
          author: user.getReference(),
          color: randomColor(),
        },
      },
      {
        upsert: true,
      },
    );
  },
});

// TODO: Publish only cursors which are not for the current connection.
Meteor.publish('Cursor.list', function cursorList(args) {
  check(args, {
    contentKey: Match.DocumentId,
  });

  this.enableScope();

  return Cursor.documents.find({
    contentKey: args.contentKey,
  }, {
    fields: Cursor.PUBLISH_FIELDS(),
  });
});

Meteor.onConnection((connection) => {
  const cleanup = Meteor.bindEnvironment(() => {
    Cursor.documents.remove({
      connectionId: connection.id,
    });

    process.removeListener('exit', cleanup);
    process.removeListener('SIGTERM', cleanup);
    process.removeListener('SIGINT', cleanup);
  });

  connection.onClose(cleanup);

  process.once('exit', cleanup);
  process.once('SIGTERM', cleanup);
  process.once('SIGINT', cleanup);
});
