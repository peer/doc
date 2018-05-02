import {check, Match} from 'meteor/check';
import {Meteor} from 'meteor/meteor';

import {Comment} from '/lib/documents/comment';

Meteor.publish('Comment.list', function commentList(args) {
  check(args, {
    documentId: Match.DocumentId,
  });

  this.enableScope();

  this.autorun((computation) => {
    return Comment.documents.find(Comment.restrictQuery({
      'document._id': args.documentId,
    }, Comment.PERMISSIONS.SEE), {
      fields: Comment.PUBLISH_FIELDS(),
    });
  });
});

export {Comment};
