import {Document} from 'meteor/peerlibrary:peerdb';
import {Meteor} from 'meteor/meteor';
import {_} from 'meteor/underscore';

export class BaseDocument extends Document {
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

  static PUBLISH_FIELDS() {
    return {};
  }

  static REFERENCE_FIELDS() {
    return {
      _id: 1,
    };
  }

  getReference() {
    return _.pick(this, Object.keys(this.constructor.REFERENCE_FIELDS()));
  }

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

  static _emptyQuery() {
    // Query which returns no documents.
    return {
      _id: {
        $in: [],
      },
    };
  }

  static restrictQuery(query, permissions, user) {
    // eslint-disable-next-line import/no-duplicates
    import {User} from '/lib/documents/user';

    if (!permissions) {
      return this._emptyQuery();
    }

    // eslint-disable-next-line no-param-reassign
    permissions = this._checkPermissions(permissions);

    if (arguments.length < 3) {
      // We are using the peerlibrary:user-extra package to make this work everywhere.
      user = Meteor.user({_id: 1}); // eslint-disable-line no-param-reassign
    }

    // Does user have a class-level permission?
    if (User.hasPermission(permissions, user)) {
      return query;
    }

    if (!user) {
      return this._emptyQuery();
    }

    // TODO: For now everyone has all instance-level permissions.
    return query;
  }

  canUser(permissions, user) {
    // eslint-disable-next-line import/no-duplicates
    import {User} from '/lib/documents/user';

    if (!permissions) {
      return false;
    }

    // eslint-disable-next-line no-param-reassign
    permissions = this.constructor._checkPermissions(permissions);

    if (arguments.length < 2) {
      // We are using the peerlibrary:user-extra package to make this work everywhere.
      user = Meteor.user({_id: 1}); // eslint-disable-line no-param-reassign
    }

    // Does user have a class-level permission?
    if (User.hasPermission(permissions, user)) {
      return true;
    }

    if (!user) {
      return false;
    }

    // TODO: For now everyone has all instance-level permissions.
    return true;
  }
}

BaseDocument.Meta({
  abstract: true,
});
