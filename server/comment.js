import {check, Match} from 'meteor/check';
import {Meteor} from 'meteor/meteor';

import {Comment} from '/lib/comment';

Meteor.publish('Comment.feed', function commentFeed(args) {
  check(args, {
    contentKey: Match.DocumentId,
  });

  this.enableScope();

  return Comment.documents.find({
    contentKey: args.contentKey,
  }, {
    fields: Comment.PUBLISH_FIELDS(),
  });
});
