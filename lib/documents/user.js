import {Meteor} from 'meteor/meteor';
import {_} from 'meteor/underscore';

import {BaseDocument} from '../base';
import {UpdatedAtTrigger, LastActivityTrigger} from '../triggers';

export class User extends BaseDocument {
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

  static EXTRA_PUBLISH_FIELDS() {
    return {
      _id: 1,
      avatar: 1,
    };
  }

  avatarUrl() {
    return this.avatar;
  }

  static defaultPermissions() {
    if (Meteor.settings.public.defaultPermissions) {
      return Meteor.settings.public.defaultPermissions;
    }
    else {
      import {Comment} from './comment';
      import {Document} from './document';

      return [].concat(_.values(Document.PERMISSIONS), _.values(Comment.PERMISSIONS));
    }
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
        return /_VIEW$/.test(permission);
      });
    }

    // TODO: For now everyone has default class-level permissions.
    return !!_.intersection(this.defaultPermissions(), permissions).length;
  }

  hasPermission(permissions) {
    // Check permissions for this user document.

    return this.constructor.hasPermission(permissions, this);
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
