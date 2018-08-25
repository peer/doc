import {Document} from 'meteor/peerlibrary:peerdb';
import {Meteor} from 'meteor/meteor';
import {_} from 'meteor/underscore';

import assert from 'assert';

export class BaseDocument extends Document {
  // _id: ID of the document

  // Verbose name is used when representing the class in a non-technical
  // setting. The convention is not to capitalize the first letter of
  // the verboseName. We capitalize the first letter where we need to.
  static verboseName() {
    // Convert TitleCase into Title Case, and make lower case.
    return this.Meta._name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
  }

  static verboseNamePlural() {
    return `${this.verboseName()}s`;
  }

  static verboseNameWithCount(quantity = 0) {
    if (quantity === 1) {
      return `1 ${this.verboseName()}`;
    }
    return `${quantity} ${this.verboseNamePlural()}`;
  }

  verboseName() {
    return this.constructor.verboseName();
  }

  verboseNamePlural() {
    return this.constructor.verboseNamePlural();
  }

  verboseNameWithCount(quantity) {
    return this.constructor.verboseNameWithCount(quantity);
  }

  static methodPrefix() {
    return this.Meta._name;
  }

  methodPrefix() {
    return this.constructor.methodPrefix();
  }

  // A list of fields to publish by default for this document.
  static PUBLISH_FIELDS() {
    return {};
  }

  // A list of fields to use in a reference by default for this document.
  static REFERENCE_FIELDS() {
    return {
      _id: 1,
    };
  }

  getReference() {
    return _.pick(this, Object.keys(this.constructor.REFERENCE_FIELDS()));
  }
}

BaseDocument.Meta({
  abstract: true,
});

export class BasePermissionedDocument extends BaseDocument {
  // _id: ID of the document
  // userPermissions: a list of
  //   user:
  //     _id
  //     username
  //     avatar
  //   addedAt: timestamp
  //   addedBy:
  //     _id
  //     username
  //     avatar
  //   permission: a permission string

  // A list of fields which are necessary to check permissions for the document.
  static PERMISSIONS_FIELDS() {
    return {
      _id: 1,
      userPermissions: 1,
    };
  }

  // We are publishing "userPermissions". This means that any publish endpoint using this "PUBLISH_FIELDS"
  // should use middleware to restrict "userPermissions" items only for the current user.
  static PUBLISH_FIELDS() {
    return _.extend(super.PUBLISH_FIELDS(), this.PERMISSIONS_FIELDS());
  }

  // Checks permission strings themselves: they should be valid strings which should exist among
  // "PERMISSIONS" of the document. Moreover it normalizes argument "permissions" to be always
  // an array of permission strings.
  static _checkPermissions(permissions) {
    if (!_.isArray(permissions)) {
      // eslint-disable-next-line no-param-reassign
      permissions = [permissions];
    }

    permissions.forEach((checkPermission) => {
      let found = false;
      for (const knownPermission of Object.values(this.PERMISSIONS || {})) {
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

  // Returns a query object which returns no documents when used.
  static _emptyQuery() {
    return {
      _id: {
        $in: [],
      },
    };
  }

  // A method to handle restricting a query for anonymous users. By default it returns
  // an empty query for them. This is a separate method for easier subclassing.
  static _restrictQueryForAnonymousUser(query, permissions) {
    return this._emptyQuery();
  }

  // This is a separate method for easier subclassing.
  static _restrictQuery(permissions, user) {
    assert(user);

    return {
      userPermissions: {
        $elemMatch: {
          'user._id': user._id,
          permission: {
            $in: permissions,
          },
        },
      },
    };
  }

  // Augments the query object "query" in a way that query will return only
  // those documents for which "users" has at least one of the "permissions"
  // (class-level or instance-level). If "user" is not provided (not even
  // passed to the method) then current user from Meteor context is used.
  static restrictQuery(query, permissions, user) {
    // eslint-disable-next-line import/no-duplicates
    import {User} from '/lib/documents/user';

    if (!permissions) {
      return this._emptyQuery();
    }

    // eslint-disable-next-line no-param-reassign
    permissions = this._checkPermissions(permissions);

    // We check if "user" has not been even passed to the method.
    // If it has been passed but it is "null", we do not use current user.
    if (arguments.length < 3) {
      // We are using the peerlibrary:user-extra package to make this work everywhere.
      user = Meteor.user(User.CHECK_PERMISSIONS_FIELDS()); // eslint-disable-line no-param-reassign
    }

    if (!user) {
      return this._restrictQueryForAnonymousUser(query, permissions);
    }

    // Does user have a class-level permission?
    if (User.hasClassPermission(permissions, user)) {
      return query;
    }

    // Augment the query with an instance-level permissions check.
    return {
      $and: [
        query,
        this._restrictQuery(permissions, user),
      ],
    };
  }

  // Returns "true" if "user" has at least one of the "permissions" (class-level or instance-level)
  // for any of the documents matching the "query". If "user" is not provided (not even passed
  // to the method) then current user from Meteor context is used.
  static existsAndCanUser(...args) {
    return this.documents.exists(this.restrictQuery(...args));
  }

  // A method to handle anonymous users. By default it does not allow anything to them.
  // This is a separate method for easier subclassing.
  // eslint-disable-next-line class-methods-use-this
  _canAnonymousUser(permissions) {
    return false;
  }

  // Returns "true" if "user" has at least one of the "permissions" (class-level or
  // instance-level) for the current document. If "user" is not provided (not even
  // passed to the method) then current user from Meteor context is used.
  canUser(permissions, user) {
    // eslint-disable-next-line import/no-duplicates
    import {User} from '/lib/documents/user';

    if (!permissions) {
      return false;
    }

    // eslint-disable-next-line no-param-reassign
    permissions = this.constructor._checkPermissions(permissions);

    // We check if "user" has not been even passed to the method.
    // If it has been passed but it is "null", we do not use current user.
    if (arguments.length < 2) {
      // We are using the peerlibrary:user-extra package to make this work everywhere.
      user = Meteor.user(User.CHECK_PERMISSIONS_FIELDS()); // eslint-disable-line no-param-reassign
    }

    if (!user) {
      return this._canAnonymousUser(permissions);
    }

    // Does user have a class-level permission?
    if (User.hasClassPermission(permissions, user)) {
      return true;
    }

    // Has user any instance-level permission listed in "permissions"?
    const found = this.userPermissions && this.userPermissions.find((userPermission) => {
      return userPermission.user && userPermission.user._id === user._id && permissions.indexOf(userPermission.permission) !== -1;
    });

    if (found) {
      return true;
    }

    return this._canUser(permissions, user);
  }

  // This is a separate method for easier subclassing.
  // eslint-disable-next-line class-methods-use-this
  _canUser(permissions, user) {
    return false;
  }
}

BasePermissionedDocument.Meta({
  abstract: true,
  fields(fields) {
    // eslint-disable-next-line import/no-duplicates
    import {User} from '/lib/documents/user';

    return _.extend(fields, {
      userPermissions: [
        {
          // Required, so the permission is removed if the user gets removed.
          user: Document.ReferenceField(User, User.REFERENCE_FIELDS()),
          addedBy: Document.ReferenceField(User, User.REFERENCE_FIELDS(), false),
        },
      ],
    });
  },
});
