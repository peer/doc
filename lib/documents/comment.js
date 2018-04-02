import {check, Match} from 'meteor/check';
import {Meteor} from 'meteor/meteor';
import {_} from 'meteor/underscore';

import {ValidatedMethod} from 'meteor/mdg:validated-method';

import {BaseDocument} from '../base';
import {method} from '../utils';
import {User} from './user';
import {Document} from './document';

export class Comment extends BaseDocument {
  // createdAt: time of document creation
  // author: user who created a comment
  //   _id
  //   username
  //   avatar
  // document: document for which the comment was created
  //   _id
  // body: content of the comment
  // versionFrom: version of the content the comment was created at
  // versionTo: version of the content the comment was removed at
  // highlightKey: ID of the content highlight with which this comment is associated with

  static REFERENCE_FIELDS() {
    return {
      _id: 1,
    };
  }

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
    });
  }

  getReference() {
    return _.pick(this, Object.keys(this.constructor.REFERENCE_FIELDS()));
  }
}

Comment.Meta({
  name: 'Comment',
  fields(fields) {
    return _.extend(fields, {
      author: Comment.ReferenceField(User, User.REFERENCE_FIELDS()),
      document: Comment.ReferenceField(Document, Document.REFERENCE_FIELDS()),
    });
  },
});

Comment.create = method(new ValidatedMethod({
  name: 'Comment.create',

  validate(args) {
    check(args, {
      documentId: Match.DocumentId,
      highlightKey: Match.DocumentId,
      body: Match.NonEmptyString,
    });
  },

  run(args) {
    const user = Meteor.user(User.REFERENCE_FIELDS());
    if (!user) {
      throw new Meteor.Error('unauthorized', "Unauthorized.");
    }

    // TODO: Check if user has access to the document.
    const document = Document.documents.findOne({_id: args.documentId}, {fields: Document.REFERENCE_FIELDS()});
    if (!document) {
      throw new Meteor.Error('not-found', `Document '${args.documentId}' cannot be found.`);
    }

    // TODO: Check more permissions?

    const createdAt = new Date();

    const commentId = Comment.documents.insert({
      createdAt,
      author: user.getReference(),
      document: document.getReference(),
      body: args.body,
      versionFrom: null,
      versionTo: null,
      highlightKey: args.highlightKey,
    });

    return {
      _id: commentId,
    };
  },
}));

Comment.setInitialVersion = method(new ValidatedMethod({
  name: 'Comment.setInitialVersion',

  validate(args) {
    check(args, {
      highlightKey: Match.DocumentId,
      version: Match.Integer,
    });
  },

  run(args) {
    const user = Meteor.user(User.REFERENCE_FIELDS());
    if (!user) {
      throw new Meteor.Error('unauthorized', "Unauthorized.");
    }

    // TODO: Check more permissions?

    return Comment.documents.update({
      highlightKey: args.highlightKey,
      versionFrom: null,
    }, {
      $set: {
        versionFrom: args.version,
      },
    });
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
    const user = Meteor.user(User.REFERENCE_FIELDS());
    if (!user) {
      throw new Meteor.Error('unauthorized', "Unauthorized.");
    }

    // TODO: Check more permissions?

    // Set versionTo to all present comments, in case of re-applying a
    // previous step, e.g., with Ctrl+Z.
    Comment.documents.update({
      'document._id': args.documentId,
      highlightKey: {
        $in: args.highlightKeys,
      },
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
