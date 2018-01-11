import {check} from 'meteor/check';
import {Meteor} from 'meteor/meteor';
import {_} from 'meteor/underscore';

import {ValidatedMethod} from 'meteor/mdg:validated-method';

import {BaseDocument} from './base';
import {User} from './user';
import {method} from './utils';

export class Content extends BaseDocument {
  // createdAt: time of document creation
  // author:
  //   _id
  //   username
  //   avatar
  // contentKey: ID used to identify editor's content
  // clientId: ID of the client which made this step
  // version: serial number for the step
  // step: step made for this version

  static REFERENCE_FIELDS() {
    return {
      _id: 1,
    };
  }

  static PUBLISH_FIELDS() {
    return _.extend(super.PUBLISH_FIELDS(), {
      _id: 1,
      clientId: 1,
      version: 1,
      step: 1,
    });
  }

  getReference() {
    return _.pick(this, this.constructor.REFERENCE_FIELDS().keys());
  }
}

Content.Meta({
  name: 'Content',
  fields(fields) {
    return _.extend(fields, {
      author: Content.ReferenceField(User, User.REFERENCE_FIELDS()),
    });
  },
});

Content.create = method(new ValidatedMethod({
  name: 'Content.create',

  validate(args) {
    check(args, {});
  },

  run() {
    const user = Meteor.user(User.REFERENCE_FIELDS());
    if (!user) {
      throw new Meteor.Error('unauthorized', "Unauthorized.");
    }

    // TODO: Check more permissions?

    const createdAt = new Date();
    const contentKey = Content.Meta.collection._makeNewID();

    const contentId = Content.documents.insert({
      createdAt,
      contentKey,
      author: user.getReference(),
      clientId: null,
      version: 0,
      step: null,
    });

    return {
      createdAt,
      contentKey,
      _id: contentId,
    };
  },
}));

// A special case which is not using ValidatedMethod because there is no stub on the client.
// Can be called without a callback on the server, but callback should be provided on the client
// if return value is wanted.
Content.addSteps = function addSteps(...args) {
  args.unshift('Content.addSteps');
  return Meteor.call(...args);
};

if (Meteor.isServer) {
  Content.Meta.collection._ensureIndex({
    contentKey: 1,
    version: -1,
  }, {
    unique: true,
  });

  Content.Meta.collection._ensureIndex({
    contentKey: 1,
  });
}
