import {check, Match} from 'meteor/check';
import {Meteor} from 'meteor/meteor';

import {Cursor} from '/lib/cursor';
import {User} from '/lib/user';
import {getRandomColor} from '/lib/utils';

Meteor.methods({
  'Cursor.update'(args) {
    check(args, {
      contentKey: Match.DocumentId,
      from: Match.Integer,
      to: Match.Integer,
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
          from: args.from,
          to: args.to,
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
  'Cursor.remove'(args) {
    check(args, {
      contentKey: Match.DocumentId,
      clientId: Match.DocumentId,
    });

    // TODO: Check more permissions?

    Cursor.documents.remove({
      contentKey: args.contentKey,
      clientId: args.clientId,
    });
  },
});

Meteor.publish('Cursor.feed', function cursorFeed(args) {
  check(args, {
    contentKey: Match.DocumentId,
  });

  this.enableScope();

  const handle = Cursor.documents.find({
    contentKey: args.contentKey,
  }, {
    fields: Cursor.PUBLISH_FIELDS(),
  }).observeChanges({
    added: (id, fields) => {
      this.added(Cursor.Meta.collection._name, id, fields);
    },

    changed: (id, fields) => {
      this.changed(Cursor.Meta.collection._name, id, fields);
    },

    removed: (id) => {
      this.removed(Cursor.Meta.collection._name, id);
    },
  });

  this.onStop(() => {
    handle.stop();
  });

  this.ready();
});
