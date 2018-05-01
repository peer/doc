import {Meteor} from 'meteor/meteor';
import {_} from 'meteor/underscore';

import {BaseDocument} from '../base';

export class User extends BaseDocument {
  // createdAt: time of document creation
  // username: user's username
  // avatar: avatar URL

  static REFERENCE_FIELDS() {
    return {
      _id: 1,
      username: 1,
      avatar: 1,
    };
  }

  static PUBLISH_FIELDS() {
    return _.extend(super.PUBLISH_FIELDS(), {
      _id: 1,
      username: 1,
      avatar: 1,
    });
  }

  static EXTRA_PUBLISH_FIELDS() {
    return {
      _id: 1,
      avatar: 1,
    };
  }

  getReference() {
    return _.pick(this, Object.keys(this.constructor.REFERENCE_FIELDS()));
  }

  avatarUrl() {
    return this.avatar;
  }

  static hasPermission(permissions, user) {
    // Check that given user has any of the listed permissions,
    // or check for the currently logged in user.

    if (!permissions) {
      return false;
    }

    if (!_.isArray(permissions)) {
      // eslint-disable-next-line no-param-reassign
      permissions = [permissions];
    }

    if (arguments.length < 2) {
      // We are using the peerlibrary:user-extra package to make this work everywhere.
      user = Meteor.user({_id: 1}); // eslint-disable-line no-param-reassign
    }

    if (!user) {
      // TODO: Have a list of permissions for anonymous users.
      return _.some(permissions, (permission) => {
        return /_SEE$/.test(permission);
      });
    }

    // TODO: For now everyone has all class-level permissions.
    return true;
  }

  hasPermission(permissions) {
    // Check permissions for this user document.

    return this.constructor.hasPermission(permissions, this);
  }
}

User.Meta({
  name: 'User',
  collection: Meteor.users,
});

User.VALID_USERNAME = /^[A-Za-z][A-Za-z0-9_]{2,}[A-Za-z0-9]$/;

if (Meteor.isServer) {
  User.Meta.collection._ensureIndex({
    createdAt: 1,
  });
}
