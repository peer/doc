import {check, Match} from 'meteor/check';
import {Meteor} from 'meteor/meteor';

import {Node} from 'prosemirror-model';

import {Comment} from '/lib/documents/comment';
import {schema} from '/lib/simple-schema.js';
import {User} from './user';
import {Document} from './document';
import {Activity} from "./activity";

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

  'Comment.create'(args) {
    check(args, {
      documentId: Match.DocumentId,
      highlightKey: Match.DocumentId,
      body: Object,
      replyTo: Match.Maybe(Match.DocumentId),
    });

    // Validate body.
    Node.fromJSON(schema, args.body).check();

    const user = Meteor.user(User.REFERENCE_FIELDS());

    // We need user reference.
    if (!user || !user.hasPermission(Comment.PERMISSIONS.CREATE)) {
      throw new Meteor.Error('unauthorized', "Unauthorized.");
    }

    const document = Document.documents.findOne(Document.restrictQuery({
      _id: args.documentId,
    }, Document.PERMISSIONS.COMMENT_CREATE, user), {fields: Document.REFERENCE_FIELDS()});
    if (!document) {
      throw new Meteor.Error('not-found', `Document cannot be found.`);
    }

    let replyTo = null;
    if (args.replyTo) {
      replyTo = Comment.documents.findOne(Comment.restrictQuery({
        _id: args.replyTo,
      }, Comment.PERMISSIONS.SEE, user), {fields: Document.REFERENCE_FIELDS()});
      if (!replyTo) {
        throw new Meteor.Error('not-found', `Comment cannot be found.`);
      }
    }

    const createdAt = new Date();

    const commentId = Comment.documents.insert({
      createdAt,
      author: user.getReference(),
      document: document.getReference(),
      body: args.body,
      versionFrom: null,
      versionTo: null,
      // TODO: Validate highlight key.
      highlightKey: args.highlightKey,
      replyTo: replyTo && replyTo.getReference(),
      status: Comment.STATUS.CREATED,
    });

    Document.documents.update({
      _id: args.documentId,
      lastActivity: {
        $lt: createdAt,
      },
    }, {
      $set: {
        lastActivity: createdAt,
      },
    });

    if (Meteor.isServer) {
      Activity.documents.insert({
        timestamp: createdAt,
        connection: this.connection.id,
        byUser: user.getReference(),
        // We inform all followers of this document.
        // TODO: Implement once we have followers.
        forUsers: [],
        type: 'commentCreated',
        level: Activity.LEVEL.GENERAL,
        data: {
          document: document.getReference(),
          comment: {
            _id: commentId,
          },
        },
      });
    }

    return {
      _id: commentId,
    };
  },

});

// For testing.
export {Comment};
