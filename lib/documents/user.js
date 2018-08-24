import {Meteor} from 'meteor/meteor';
import {_} from 'meteor/underscore';

import {BaseDocument} from '../base';
import {UpdatedAtTrigger, LastActivityTrigger} from '../triggers';

export class User extends BaseDocument {
  // _id: ID of the document
  // createdAt: time of document creation
  // updatedAt: time of the last change
  // lastActivity: time of the last user app activity (login, password change,
  //               authored anything, voted on anything, etc.)
  // username: user's username
  // avatar: avatar URL
  // emails
  // services

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

  // Additional fields published for the current user.
  static EXTRA_PUBLISH_FIELDS() {
    return _.extend({
      _id: 1,
      avatar: 1,
    }, this.CHECK_PERMISSIONS_FIELDS());
  }

  // A list of "User" fields which are necessary to check permissions for other documents.
  // TODO: Extend with fields needed to check class-level permissions.
  static CHECK_PERMISSIONS_FIELDS() {
    return {
      _id: 1,
    };
  }

  avatarUrl() {
    return this.avatar;
  }

  // Default class-level permissions for all users.
  static defaultClassPermissions() {
    if (Meteor.settings.public.defaultPermissions) {
      return Meteor.settings.public.defaultPermissions;
    }
    else {
      // eslint-disable-next-line no-console
      console.warn("Default permissions not set in settings.");
      return [];
    }
  }

  // Check if the "user" has any of the class-level "permissions". If "user" is not provided
  // (not even passed to the method) then current user from Meteor context is used.
  static hasClassPermission(permissions, user) {
    if (!permissions) {
      return false;
    }

    if (!_.isArray(permissions)) {
      // eslint-disable-next-line no-param-reassign
      permissions = [permissions];
    }

    // We check if "user" has not been even passed to the method.
    // If it has been passed but it is "null", we do not use current user.
    if (arguments.length < 2) {
      // We are using the peerlibrary:user-extra package to make this work everywhere.
      user = Meteor.user({_id: 1}); // eslint-disable-line no-param-reassign
    }

    // Anonymous users do not have class-level permissions.
    if (!user) {
      return false;
    }

    // Check default class-level permissions.
    if (_.intersection(this.defaultClassPermissions(), permissions).length) {
      return true;
    }

    // TODO: Check class-level permissions for this user.
    return false;
  }

  // Check class-level "permissions" for this user document.
  hasClassPermission(permissions) {
    return this.constructor.hasClassPermission(permissions, this);
  }
}

User.Meta({
  name: 'User',
  collection: Meteor.users,
  triggers(triggers) {
    return _.extend(triggers, {
      updatedAt: UpdatedAtTrigger(['username', 'avatar', 'emails']),
      lastActivity: LastActivityTrigger(['services']),
    });
  },
});

User.findByUsername = function findByUsername(...args) {
  args.unshift('User.findByUsername');
  return Meteor.call(...args);
};

User.VALID_USERNAME = /^[A-Za-z][A-Za-z0-9_]{2,}[A-Za-z0-9]$/;

if (Meteor.isServer) {
  User.Meta.collection._ensureIndex({
    createdAt: 1,
  });
}
