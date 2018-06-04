import {check, Match} from 'meteor/check';
import {Meteor} from 'meteor/meteor';
import {_} from 'meteor/underscore';

import {ValidatedMethod} from 'meteor/mdg:validated-method';

import {Node} from 'prosemirror-model';

import {BaseDocument} from '../base';
import {method} from '../utils';
import {schema} from '../simple-schema.js';
import {User} from './user';
import {Document} from './document';
import {Activity} from "./activity";

export class Comment extends BaseDocument {
  // createdAt: time of document creation
  // author: user who created a comment
  //   _id
  //   username
  //   avatar
  // document: document for which the comment was created
  //   _id
  // body: content of the comment as ProseMirror document
  // versionFrom: version of the content the comment was created at
  // versionTo: version of the content the comment was removed at
  // highlightKey: ID of the content highlight with which this comment is associated with
  // replyTo:
  //   _id: reply to which other comment this is
  // deletedAt: time of document deletion
  // status: determines whether a document is CREATED, DELETED or RESOLVED.

  static PUBLISH_FIELDS() {
    return _.extend(super.PUBLISH_FIELDS(), {
      _id: 1,
      author: 1,
      document: 1,
      body: 1,
      versionFrom: 1,
      versionTo: 1,
      highlightKey: 1,
      createdAt: 1,
      replyTo: 1,
      status: 1,
      deletedAt: 1,
    });
  }
}

Comment.Meta({
  name: 'Comment',
  fields(fields) {
    return _.extend(fields, {
      author: Comment.ReferenceField(User, User.REFERENCE_FIELDS()),
      document: Comment.ReferenceField(Document, Document.REFERENCE_FIELDS()),
      replyTo: Comment.ReferenceField(Comment, Comment.REFERENCE_FIELDS(), false),
    });
  },
});

Comment.PERMISSIONS = {
  // We use upper case even for strings because we are using upper case for permissions and lower case for roles.
  SEE: 'COMMENT_SEE',
  CREATE: 'COMMENT_CREATE',
  DELETE: 'COMMENT_DELETE',
  DELETE_OWN: 'COMMENT_DELETE_OWN',
};

Comment.STATUS = {
  CREATED: 'CREATED',
  DELETED: 'DELETED',
  RESOLVED: 'RESOLVED',
};

Comment.create = method(new ValidatedMethod({
  name: 'Comment.create',

  validate(args) {
    check(args, {
      documentId: Match.DocumentId,
      highlightKey: Match.DocumentId,
      body: Object,
      replyTo: Match.Maybe(Match.DocumentId),
    });
  },

  run(args) {
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
}));

Comment.filterOrphan = method(new ValidatedMethod({
  name: "Comment.filterOrphan",

  validate(args) {
    check(args, {
      documentId: Match.DocumentId,
      highlightKeys: [Match.DocumentId],
      version: Match.Integer,
    });
  },

  run(args) {
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
}));

Comment.delete = function remove(...args) {
  args.unshift('Comment.delete');
  return Meteor.call(...args);
};

Comment.setInitialVersion = function setInitialVersion(...args) {
  args.unshift('Comment.setInitialVersion');
  return Meteor.call(...args);
};