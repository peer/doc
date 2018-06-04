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
  'Comment.setInitialVersion'(args) {
    check(args, {
      version: Match.Integer,
      highlightKeys: [Match.DocumentId],
    });

    const user = Meteor.user({_id: 1});

    // TODO: This check is temporary, we should not need this method at all.
    if (!user || !user.hasPermission(Comment.PERMISSIONS.CREATE)) {
      throw new Meteor.Error('unauthorized', "Unauthorized.");
    }

    return Comment.documents.update({
      highlightKey: {
        $in: args.highlightKeys,
      },
      versionFrom: null,
    }, {
      $set: {
        versionFrom: args.version,
      },
    }, {
      multi: true,
    });
  },
  'Comment.filterOrphan'(args) {
    check(args, {
      documentId: Match.DocumentId,
      highlightKeys: [Match.DocumentId],
      version: Match.Integer,
    });

    const user = Meteor.user({_id: 1});

    // TODO: This check is temporary, we should not need this method at all.
    if (!user || !user.hasPermission(Comment.PERMISSIONS.CREATE)) {
      throw new Meteor.Error('unauthorized', "Unauthorized.");
    }

    // Set versionTo to all CREATED comments with highlights present in the current editor state, in case of
    // re-applying a previous step, e.g., with Ctrl+Z.
    Comment.documents.update({
      'document._id': args.documentId,
      highlightKey: {
        $in: args.highlightKeys,
      },
      status: Comment.STATUS.CREATED,
    }, {
      $set: {
        versionTo: null,
      },
    }, {
      multi: true,
    });

    Comment.documents.update({
      'document._id': args.documentId,
      highlightKey: {
        $nin: args.highlightKeys,
      },
      status: Comment.STATUS.CREATED,
      versionTo: null,
    }, {
      $set: {
        versionTo: args.version,
      },
    }, {
      multi: true,
    });
  },
});

// For testing.
export {Comment};
