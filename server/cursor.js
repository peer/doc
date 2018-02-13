import {check, Match} from 'meteor/check';
import {Meteor} from 'meteor/meteor';

import {Cursor} from '/lib/cursor';
import {User} from '/lib/user';
import randomColor from 'randomcolor';

Meteor.methods({
  'Cursor.update'(args) {
    check(args, {
      contentKey: Match.DocumentId,
      head: Match.Integer,
      ranges: [{beginning: Number, end: Number}],
      clientId: Match.DocumentId,
    });

    const user = Meteor.user(User.REFERENCE_FIELDS());

    // TODO: Check more permissions?

    const createdAt = new Date();
    Cursor.documents.update(
      {
        contentKey: args.contentKey,
        clientId: args.clientId,
      },
      {
        $set: {
          head: args.head,
          ranges: args.ranges,
        },
        $setOnInsert: {
          createdAt,
          connection: this.connection.id,
          author: user && user.getReference(),
          clientId: args.clientId,
          color: randomColor(),
          contentKey: args.contentKey,
        },
      },
      {
        upsert: true,
      },
    );
  },
  'Cursor.clear'(args) {
    check(args, {
      connection: String,
    });

    // TODO: Check more permissions?

    Cursor.documents.remove({
      connection: args.connection,
    });
  },
});

Meteor.publish('Cursor.feed', function cursorFeed(args) {
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
