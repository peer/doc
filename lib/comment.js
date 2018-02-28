import {check, Match} from 'meteor/check';
import {Meteor} from 'meteor/meteor';
import {_} from 'meteor/underscore';

import {ValidatedMethod} from 'meteor/mdg:validated-method';

import {BaseDocument} from './base';
import {User} from './user';
import {method} from './utils';

export class Comment extends BaseDocument {
  // createdAt: time of document creation
  // author:
  //   _id
  //   username
  //   avatar
  // versionFrom: Version the comment was created
  // versionTo: Version the comment was removed
  // text: Text of the comment
  // highlightId: Id of the highlight span (the section of the document affected)

  static REFERENCE_FIELDS() {
    return {
      _id: 1,
    };
  }

  static PUBLISH_FIELDS() {
    return _.extend(super.PUBLISH_FIELDS(), {
      _id: 1,
      highlightId: 1,
      contentKey: 1,
      versionFrom: 1,
      versionTo: 1,
      text: 1,
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
    });
  },
});

Comment.create = method(new ValidatedMethod({
  name: 'Comment.create',

  validate(args) {
    check(args, {
      highlightId: String,
      text: String,
      contentKey: Match.DocumentId,
    });
  },

  run(args) { // eslint-disable-line no-empty-pattern
    const user = Meteor.user(User.REFERENCE_FIELDS());
    if (!user) {
      throw new Meteor.Error('unauthorized', "Unauthorized.");
    }

    // TODO: Check more permissions?

    const createdAt = new Date();

    const commentId = Comment.documents.insert({
      createdAt,
      highlightId: args.highlightId,
      contentKey: args.contentKey,
      text: args.text,
      author: user.getReference(),
      versionFrom: null,
      versionTo: null,
    });

    return {
      createdAt,
      _id: commentId,
    };
  },
}));

Comment.setInitialVersion = method(new ValidatedMethod({
  name: 'Comment.setInitialVersion',

  validate(args) {
    check(args, {
      version: Match.Integer,
      highlightId: String,
    });
  },

  run(args) { // eslint-disable-line no-empty-pattern
    const user = Meteor.user(User.REFERENCE_FIELDS());
    if (!user) {
      throw new Meteor.Error('unauthorized', "Unauthorized.");
    }

    // TODO: Check more permissions?
    const commentId = Comment.documents.update({
      highlightId: args.highlightId,
    }, {
      $set: {
        versionFrom: args.version,
      },
    });

    return {
      _id: commentId,
    };
  },
}));

Comment.filterOrphan = method(new ValidatedMethod({
  name: "Comment.filterOrphan",

  validate(args) {
    check(args, {
      highlightIds: [String],
      contentKey: String,
      version: Match.Integer,
    });
  },

  run(args) {
    const user = Meteor.user(User.REFERENCE_FIELDS());
    if (!user) {
      throw new Meteor.Error('unauthorized', "Unauthorized.");
    }

    // Set versionTo to all present comments, (in case of re-applying a
    // previous step, (e.g.: with Ctrl+Z).
    Comment.documents.update({
      contentKey: args.contentKey,
      highlightId: {
        $in: args.highlightIds,
      },
    }, {
      $set: {
        versionTo: undefined,
      },
    }, {
      multi: true,
    });

    // TODO: Check more permissions?
    Comment.documents.update({
      contentKey: args.contentKey,
      highlightId: {
        $nin: args.highlightIds,
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
