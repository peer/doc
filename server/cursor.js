import {check, Match} from 'meteor/check';
import {Meteor} from 'meteor/meteor';

import {Cursor} from '/lib/cursor';
import {User} from '/lib/user';

Meteor.methods({
  'Cursor.update'(args) {
    check(args, {
      contentKey: Match.DocumentId,
      position: Match.Integer,
    });

    const user = Meteor.user(User.REFERENCE_FIELDS());
    if (!user) {
      throw new Meteor.Error('unauthorized', "Unauthorized.");
    }

    // TODO: Check more permissions?

    const createdAt = new Date();
    Cursor.documents.update(
      {
        contentKey: args.contentKey,
        author: user.getReference(),
      },
      {
        $set: {
          position: args.position,
        },
        $setOnInsert: {
          createdAt,
          author: user.getReference(),
          contentKey: args.contentKey,
        },
      },
      {
        upsert: true,
      },
    );
  },
});
