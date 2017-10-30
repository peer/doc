import {Meteor} from 'meteor/meteor';
import {_} from 'meteor/underscore';

import {BaseDocument} from './base';

export class User extends BaseDocument {
  // createdAt: time of document creation
  // username: user's username
  // avatar: avatar URL

  static REFERENCE_FIELDS() {
    return {
      _id: 1,
      username: 1,
      avatar: 1
    }
  }

  static PUBLISH_FIELDS() {
    return _.extend(super.PUBLISH_FIELDS(), {
      _id: 1,
      username: 1,
      avatar: 1
    });
  }

  getReference() {
    return _.pick(this, _.keys(this.constructor.REFERENCE_FIELDS()));
  }

  avatarUrl() {
    return this.avatar;
  }
}

User.Meta({
  name: 'User',
  collection: Meteor.users
});

if (Meteor.isServer) {
  User.Meta.collection._ensureIndex({
    createdAt: 1
  });

  User.Meta.collection._ensureIndex({
    updatedAt: 1
  });
}
