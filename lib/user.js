import {Meteor} from 'meteor/meteor';
import {_} from 'meteor/underscore';

import {ValidatedMethod} from 'meteor/mdg:validated-method';

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

  static EXTRA_PUBLISH_FIELDS() {
    return {
      _id: 1,
      avatar: 1
    }
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
  collection: Meteor.users,
  generators(generators) {
    return _.extend(generators, {
      // We include "avatar" field so the if it gets deleted it gets regenerated.
      avatar: User.GeneratedField('self', ['username', 'avatar'], (fields) => {
        const username = fields.username || '';
        let hash = 0;
        for (let i = 0; i < username.length; i++) {
          hash += username.charCodeAt(i);
        }
        const type = hash % 2 === 0 ? 'men' : 'women';
        hash >>= 1;

        return [fields._id, `https://randomuser.me/api/portraits/${type}/${hash % 100}.jpg`];
      })
    });
  }
});

User.VALID_USERNAME = /^[A-Za-z][A-Za-z0-9_]{2,}[A-Za-z0-9]$/;

// A special case which is not using ValidatedMethod.
User.createUserAndSignIn = function ({username}, callback) {
  Accounts.callLoginMethod({
    methodName: 'User.createUserAndSignIn',
    methodArguments: [{username}],
    userCallback: callback
  });
};

if (Meteor.isServer) {
  User.Meta.collection._ensureIndex({
    createdAt: 1
  });
}
