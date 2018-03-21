import {check, Match} from 'meteor/check';
import {Meteor} from 'meteor/meteor';

import {Comment} from '/lib/documents/comment';

Meteor.publish('Comment.list', function commentList(args) {
  check(args, {
    documentId: Match.DocumentId,
  });

  this.enableScope();

  return Comment.documents.find({
    'document._id': args.documentId,
  }, {
    fields: Comment.PUBLISH_FIELDS(),
  });
});
