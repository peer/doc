import {check} from 'meteor/check';
import {Meteor} from 'meteor/meteor';
import {_} from 'meteor/underscore';

import {ValidatedMethod} from 'meteor/mdg:validated-method';

import {BaseDocument} from './base';
import {User} from './user';
import {method} from './utils';

export class Comment {
  constructor(from, to, text, id) {
    this.from = from;
    this.to = to;
    this.text = text;
    this.id = id;
  }

  static fromJSON(json) {
    return new Comment(json.from, json.to, json.text, json.id);
  }
}

export class Comments extends BaseDocument {
  static REFERENCE_FIELDS() {
    return {
      _id: 1,
    };
  }

  static PUBLISH_FIELDS() {
    return _.extend(super.PUBLISH_FIELDS(), {
      _id: 1,
      contentKey: 1,
      clientId: 1,
      version: 1,
      comment: 1,
    });
  }

  getReference() {
    return _.pick(this, Object.keys(this.constructor.REFERENCE_FIELDS()));
  }
}

Comments.Meta({
  name: 'Comments',
  fields(fields) {
    return _.extend(fields, {
      author: Comments.ReferenceField(User, User.REFERENCE_FIELDS()),
    });
  },
});

Comments.create = method(new ValidatedMethod({
  name: 'Comments.create',

  validate(args) {
    check(args, {});
  },

  run({contentKey}) { // eslint-disable-line no-empty-pattern
    const user = Meteor.user(User.REFERENCE_FIELDS());
    if (!user) {
      throw new Meteor.Error('unauthorized', "Unauthorized.");
    }

    // TODO: Check more permissions?

    const createdAt = new Date();

    const commentsId = Comments.documents.insert({
      createdAt,
      contentKey,
      author: user.getReference(),
      clientId: null,
      version: 0,
      comment: null,
    });

    return {
      createdAt,
      contentKey,
      _id: commentsId,
    };
  },
}));

// A special case which is not using ValidatedMethod because there is no stub on the client.
// Can be called without a callback on the server, but callback should be provided on the client
// if return value is wanted.
Comments.addSteps = function addSteps(...args) {
  args.unshift('Comments.addComments');
  return Meteor.call(...args);
};

if (Meteor.isServer) {
  Comments.Meta.collection._ensureIndex({
    contentKey: 1,
    version: -1,
  }, {
    unique: true,
  });

  Comments.Meta.collection._ensureIndex({
    contentKey: 1,
  });
}
