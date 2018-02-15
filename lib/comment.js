import {check, Match} from 'meteor/check';
import {Meteor} from 'meteor/meteor';
import {_} from 'meteor/underscore';

import {ValidatedMethod} from 'meteor/mdg:validated-method';

import {BaseDocument} from './base';
import {User} from './user';
import {method} from './utils';

export class Comment extends BaseDocument {
  static REFERENCE_FIELDS() {
    return {
      _id: 1,
    };
  }

  static PUBLISH_FIELDS() {
    return _.extend(super.PUBLISH_FIELDS(), {
      _id: 1,
      text: 1,
      from: 1,
      to: 1,
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
      clientId: Match.DocumentId,
      text: String,
      from: Match.Integer,
      to: Match.Integer,
    });
  },

  run(args) { // eslint-disable-line no-empty-pattern
    const user = Meteor.user(User.REFERENCE_FIELDS());
    if (!user) {
      throw new Meteor.Error('unauthorized', "Unauthorized.");
    }

    // TODO: Check more permissions?

    const createdAt = new Date();
    const contentKey = Comment.Meta.collection._makeNewID();

    const contentId = Comment.documents.insert({
      createdAt,
      contentKey,
      author: user.getReference(),
      clientId: args.clientId,
      text: args.text,
      from: args.from,
      to: args.to,
    });

    return {
      createdAt,
      contentKey,
      _id: contentId,
    };
  },
}));
