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

// Server-side only methods, so we are not using ValidatedMethod.
Meteor.methods({
  'Comment.delete'(args) {
    check(args, {
      _id: Match.DocumentId,
      documentId: Match.DocumentId,
      version: Match.Integer,
    });

    const user = Meteor.user({_id: 1});
    const deletedAt = new Date();

    if (!user || !user.hasPermission(Comment.PERMISSIONS.DELETE)) {
      throw new Meteor.Error('unauthorized', "Unauthorized.");
    }

    Comment.documents.update(
      {
        $or: [{
          _id: args._id,
        },
        {
          replyTo: {
            _id: args._id,
          },
        }],
        versionTo: null,
      },
      {
        $set: {
          versionTo: args.version,
          status: Comment.STATUS.DELETED,
          deletedAt,
        },
      }, {
        multi: true,
      },
    );
  },
});

// For testing.
export {Comment};
