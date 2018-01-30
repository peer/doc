import {check, Match} from 'meteor/check';
import {Meteor} from 'meteor/meteor';

import {Cursor} from '/lib/cursor';
import {User} from '/lib/user';
import {getRandomColor} from '/lib/utils';

Meteor.methods({
  'Cursor.update'(args) {
    check(args, {
      contentKey: Match.DocumentId,
      position: Match.Integer,
      clientId: Match.DocumentId,
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
        clientId: args.clientId,
      },
      {
        $set: {
          position: args.position,
        },
        $setOnInsert: {
          createdAt,
          author: user.getReference(),
          clientId: args.clientId,
          color: getRandomColor(),
          contentKey: args.contentKey,
        },
      },
      {
        upsert: true,
      },
    );
  },
});
