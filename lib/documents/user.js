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

  static _checkPermissions(permission) {
    let permissions;
    if (!_.isArray(permission)) {
      permissions = [permission];
    }
    else {
      permissions = permission;
    }

    permissions.forEach((checkPermission) => {
      let found = false;
      for (const knownPermission of Object.values(this.PERMISSIONS)) {
        if (knownPermission === checkPermission) {
          found = true;
          break;
        }
      }

      // We want to be strict and catch any invalid permission. One should
      // be using constants and not strings directly anyway.
      if (!found) {
        throw new Error(`Unknown permission '${checkPermission}'.`);
      }
    });

    return permissions;
  }

  static hasPermission(permission) {
    const permissions = this._checkPermissions(permission); // eslint-disable-line no-unused-vars

    // We are using the peerlibrary:user-extra package to make this work everywhere.
    const userId = Meteor.userId();
    if (!userId) {
      return false;
    }

    // TODO: For now everyone has all permissions.
    return true;
  }

  getReference() {
    return _.pick(this, Object.keys(this.constructor.REFERENCE_FIELDS()));
  }

  avatarUrl() {
    return this.avatar;
  }
}

User.Meta({
  name: 'User',
  collection: Meteor.users,
});

User.VALID_USERNAME = /^[A-Za-z][A-Za-z0-9_]{2,}[A-Za-z0-9]$/;

User.PERMISSIONS = {
  // We use upper case even for strings because we are using upper case for permissions and lower case for roles.
  DOCUMENT_SEE: 'DOCUMENT_SEE',
  DOCUMENT_CREATE: 'DOCUMENT_CREATE',
  DOCUMENT_CREATE_API: 'DOCUMENT_CREATE_API',
  DOCUMENT_ADMIN: 'DOCUMENT_ADMIN',
  DOCUMENT_ADMIN_API: 'DOCUMENT_ADMIN_API',
  DOCUMENT_UPDATE: 'DOCUMENT_UPDATE',
  DOCUMENT_COMMENT_SEE: 'DOCUMENT_COMMENT_SEE',
  DOCUMENT_COMMENT_CREATE: 'DOCUMENT_COMMENT_CREATE',
};

if (Meteor.isServer) {
  User.Meta.collection._ensureIndex({
    createdAt: 1,
  });
}
