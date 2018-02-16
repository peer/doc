import {check, Match} from 'meteor/check';
import {Meteor} from 'meteor/meteor';

import {Comment, Comments} from '/lib/comments';
import {User} from '/lib/user';

Meteor.methods({
  'Comments.addComments'(args) {
    check(args, {
      contentKey: Match.DocumentId,
      currentVersion: Match.Integer,
      comments: [Comment],
      clientId: Match.DocumentId,
    });

    const user = Meteor.user(User.REFERENCE_FIELDS());
    if (!user) {
      throw new Meteor.Error('unauthorized', "Unauthorized.");
    }

    // TODO: Check more permissions?

    let addedCount = 0;
    const latestComments = Comments.documents.findOne({contentKey: args.contentKey}, {sort: {version: -1}, fields: {version: 1}});

    if (latestComments.version !== args.currentVersion) {
      return addedCount;
    }

    const createdAt = new Date();

    for (const comment of args.comments) {
      const {numberAffected, insertedId} = Comments.documents.upsert({ // eslint-disable-line no-unused-vars
        contentKey: args.contentKey,
        version: args.currentVersion + addedCount + 1,
      }, {
        $setOnInsert: {
          createdAt,
          author: user.getReference(),
          clientId: args.clientId,
          // We do not store steps serialized wth EJSON but normal JSON to make it cleaner.
          comment,
        },
      });

      if (!insertedId) {
        break;
      }

      addedCount += 1;
    }

    return addedCount;
  },
});

Meteor.publish('Comments.feed', function contentFeed(args) {
  check(args, {
    contentKey: Match.DocumentId,
  });

  this.enableScope();

  const handle = Comments.documents.find({
    contentKey: args.contentKey,
  }, {
    fields: Comments.PUBLISH_FIELDS(),
  // We do not store steps serialized wth EJSON but
  // normal JSON so we have to manually deserialize them.
  }).observeChanges({
    added: (id, fields) => {
      if (fields.comment) {
        fields.comment = Comment.fromJSON(fields.comment); // eslint-disable-line no-param-reassign
      }
      this.added(Comments.Meta.collection._name, id, fields);
    },

    changed: (id, fields) => {
      if (fields.comment) {
        fields.comment = Comment.fromJSON(fields.comment); // eslint-disable-line no-param-reassign
      }
      this.changed(Comment.Meta.collection._name, id, fields);
    },

    removed: (id) => {
      this.removed(Comment.Meta.collection._name, id);
    },
  });

  this.onStop(() => {
    handle.stop();
  });

  this.ready();
});
