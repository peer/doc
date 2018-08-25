import {check, Match} from 'meteor/check';
import {Meteor} from 'meteor/meteor';
import {_} from 'meteor/underscore';

import assert from 'assert';
import {Node} from 'prosemirror-model';

import {Comment} from '/lib/documents/comment';
import {Content} from '/lib/documents/content';
import {schema} from '/lib/simple-schema.js';

import {Activity} from './activity';
import {Document} from './document';
import {User} from './user';

// Here we assume this is called from a trusted place and we do not check permissions again.
Comment.filterOrphan = (documentId, doc, version) => {
  const highlightKeys = [];

  doc.descendants((node, pos) => {
    const mark = _.find(node.marks, (m) => {
      return m.type.name === 'highlight';
    });
    if (mark) {
      highlightKeys.push(mark.attrs['highlight-key']);
    }
  });

  // Set "versionTo" to "null" for all "CREATED" comments with highlights present in the
  // current editor state, in case of re-applying a previous step, e.g., with Ctrl+Z.
  Comment.documents.update({
    'document._id': documentId,
    highlightKey: {
      $in: highlightKeys,
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
    'document._id': documentId,
    highlightKey: {
      $nin: highlightKeys,
    },
    status: Comment.STATUS.CREATED,
    versionTo: null,
  }, {
    $set: {
      versionTo: version,
    },
  }, {
    multi: true,
  });
};

// Server-side only methods, so we are not using ValidatedMethod.
// TODO: Should we add/modify/delete an Activity?
Meteor.methods({
  'Comment.delete'(args) {
    check(args, {
      _id: Match.DocumentId,
      documentId: Match.DocumentId,
      version: Match.Integer,
    });

    const user = Meteor.user(_.extend(User.REFERENCE_FIELDS(), User.CHECK_PERMISSIONS_FIELDS()));

    const deletedAt = new Date();

    // We do not do additional permission check on the document in this case.
    return Comment.documents.update(Comment.restrictQuery({
      $or: [
        {
          _id: args._id,
        },
        {
          replyTo: {
            _id: args._id,
          },
        },
      ],
    }, Comment.PERMISSIONS.DELETE, user), {
      $set: {
        deletedAt,
        deletedBy: user.getReference(),
        versionTo: args.version,
        status: Comment.STATUS.DELETED,
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
      contentKey: Match.DocumentId,
    });

    // Validate body.
    Node.fromJSON(schema, args.body).check();

    const user = Meteor.user(_.extend(User.REFERENCE_FIELDS(), User.CHECK_PERMISSIONS_FIELDS()));

    // We first check that the user has a class-level permission to create comments.
    if (!User.hasClassPermission(Comment.PERMISSIONS.CREATE, user)) {
      throw new Meteor.Error('unauthorized', "Unauthorized.");
    }

    // We need a user reference.
    assert(user);

    // Then we check that the user has permissions on comment's document.
    const document = Document.documents.findOne(Document.restrictQuery({
      _id: args.documentId,
    }, Document.PERMISSIONS.COMMENT_CREATE, user), {fields: Document.REFERENCE_FIELDS()});
    if (!document) {
      throw new Meteor.Error('not-found', `Document cannot be found.`);
    }

    const {version} = Content.getCurrentState(args.contentKey);

    let replyTo = null;
    if (args.replyTo) {
      replyTo = Comment.documents.findOne(Comment.restrictQuery({
        _id: args.replyTo,
      }, Comment.PERMISSIONS.VIEW, user), {fields: Document.REFERENCE_FIELDS()});
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
      versionFrom: version,
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

    return {
      _id: commentId,
    };
  },

});

// TODO: Add middleware and restrict what is published for "userPermissions".
Meteor.publish('Comment.list', function commentList(args) {
  check(args, {
    documentId: Match.DocumentId,
  });

  this.enableScope();

  this.autorun((computation) => {
    const user = Meteor.user(User.CHECK_PERMISSIONS_FIELDS());

    // We first check that the user has permissions on comment's document.
    if (!Document.existsAndCanUser({_id: args.documentId}, Document.PERMISSIONS.COMMENT_VIEW, user)) {
      return [];
    }

    // And then we publish only those comments for which the user has permission.
    return Comment.documents.find(Comment.restrictQuery({
      'document._id': args.documentId,
      status: Comment.STATUS.CREATED,
    }, Comment.PERMISSIONS.VIEW, user), {
      fields: Comment.PUBLISH_FIELDS(),
    });
  });
});

// For testing.
export {Comment};
