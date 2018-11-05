import {Meteor} from 'meteor/meteor';
import {_} from 'meteor/underscore';

import assert from 'assert';

import {User} from './user';
import {BasePermissionedDocument} from '../base';
import {callAsync} from '../utils';

export class Document extends BasePermissionedDocument {
  // _id: ID of the document
  // createdAt: time of document creation
  // updatedAt: time of the last change
  // lastActivity: time of the last activity on the document
  // author:
  //   _id
  //   username
  //   avatar
  // publishedBy:
  //   _id
  //   username
  //   avatar
  // publishedAt: time when document was published
  // title: automatically generated title from the latest version of the document
  // contentKey: ID used to identify editor's content
  // body: content of the document as ProseMirror document
  // version: of the ProseMirror document
  // forkedFrom: reference to the parent document
  //   _id
  // forkedAtVersion: version at which this document was forked from the parent document
  // rebasedAtVersion: version to which this document was last rebased from the parent document
  // isRebasing: "true" if document is being rebased
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
  // visibility: document visibility level ("private", "public" or "listed")
  // defaultPermissions: a list of permission strings used for "public" and "listed" visibility

  static PUBLISH_FIELDS() {
    return _.extend(super.PUBLISH_FIELDS(), {
      _id: 1,
      createdAt: 1,
      publishedAt: 1,
      title: 1,
      contentKey: 1,
      forkedFrom: 1,
      rebasedAtVersion: 1,
      status: 1,
    });
  }

  static PERMISSIONS_FIELDS() {
    return _.extend(super.PERMISSIONS_FIELDS(), {
      visibility: 1,
      defaultPermissions: 1,
      publishedAt: 1,
    });
  }

  static PERMISSIONS = {
    // We use upper case even for strings because we are using upper case for permissions and lower case for roles.
    VIEW: 'DOCUMENT_VIEW',
    CREATE: 'DOCUMENT_CREATE',
    UPDATE: 'DOCUMENT_UPDATE',
    // Merge permission is about permission to merge new content into this document.
    MERGE: 'DOCUMENT_MERGE',
    ADMIN: 'DOCUMENT_ADMIN',
    COMMENT_VIEW: 'DOCUMENT_COMMENT_VIEW',
    COMMENT_CREATE: 'DOCUMENT_COMMENT_CREATE',
    PRIVATE_COMMENT_VIEW: 'DOCUMENT_PRIVATE_COMMENT_VIEW',
    PRIVATE_COMMENT_CREATE: 'DOCUMENT_PRIVATE_COMMENT_CREATE',
  };

  static ROLES = {
    VIEW: 'view',
    COMMENT: 'comment',
    EDIT: 'edit',
    ADMIN: 'admin',
  };

  static VISIBILITY_LEVELS = {
    PRIVATE: 'private',
    PUBLIC: 'public',
    LISTED: 'listed',
  };

  isPublished() {
    return !!this.publishedAt;
  }

  // This method should return "true" only for queries which match documents
  // explicitly specified by their IDs. It should not allow queries to return
  // documents without already knowing their ID.
  static _isDirectDocumentQuery(query) {
    if (!_.isObject(query)) {
      return false;
    }

    // Iterate over keys which uniquely identify a document.
    for (const field of ['_id', 'contentKey']) {
      if (_.isString(query[field])) {
        return true;
      }
      if (_.isObject(query[field]) && query[field].$in && _.isArray(query[field].$in) && query[field].$in.length && _.every(query[field].$in, _.isString)) {
        return true;
      }
    }

    if (query.$and && _.isArray(query.$and) && query.$and.length && _.some(query.$and, this._isDirectDocumentQuery, this)) {
      return true;
    }

    return false;
  }

  static _getAllowedVisibilityLevels(query) {
    if (this._isDirectDocumentQuery(query)) {
      return [this.VISIBILITY_LEVELS.PUBLIC, this.VISIBILITY_LEVELS.LISTED];
    }
    else {
      return [this.VISIBILITY_LEVELS.LISTED];
    }
  }

  // We specially handle public and listed documents. We return public documents only if
  // the query explicitly specifies them by their IDs.
  static _restrictQueryForAnonymousUser(query, permissions) {
    const allowedVisibilityLevels = this._getAllowedVisibilityLevels(query);

    // An anonymous user can at most do only things a "view" role can.
    const anonymousPermissions = _.intersection(permissions, this.getPermissionsFromRole(this.ROLES.VIEW));

    // "UPDATE" and "MERGE" permissions should not be among these permissions because we do not
    // have any special logic in this method to handle documents based on their published status.
    assert(!_.contains(anonymousPermissions, this.PERMISSIONS.UPDATE));
    assert(!_.contains(anonymousPermissions, this.PERMISSIONS.MERGE));

    return {
      $and: [
        query,
        {
          visibility: {$in: allowedVisibilityLevels},
          defaultPermissions: {$in: anonymousPermissions},
        },
      ],
    };
  }

  // We specially handle published documents and do not allow "UPDATE" permission for them.
  // We specially handle published documents and do allow "MERGE" permission only for them.
  // We specially handle public and listed documents. We return public documents using
  // default permissions only if the query explicitly specifies them by their IDs. On
  // the other hand, we do not care about the type of query if the user has instance-level
  // permissions on documents.
  static _limitQuery(query, permissions, user) {
    assert(user);

    const updatePermissions = _.intersection(permissions, [this.PERMISSIONS.UPDATE]);
    const mergePermissions = _.intersection(permissions, [this.PERMISSIONS.MERGE]);
    const otherPermissions = _.without(permissions, this.PERMISSIONS.UPDATE, this.PERMISSIONS.MERGE);

    const allowedVisibilityLevels = this._getAllowedVisibilityLevels(query);

    const queries = [];

    if (updatePermissions.length) {
      queries.push({
        $and: [
          super._limitQuery(query, updatePermissions, user),
          {
            publishedAt: null,
          },
        ],
      });
      queries.push({
        visibility: {$in: allowedVisibilityLevels},
        defaultPermissions: {$in: updatePermissions},
        publishedAt: null,
      });
    }
    if (mergePermissions.length) {
      queries.push({
        $and: [
          super._limitQuery(query, mergePermissions, user),
          {
            publishedAt: {$ne: null},
          },
        ],
      });
      queries.push({
        visibility: {$in: allowedVisibilityLevels},
        defaultPermissions: {$in: mergePermissions},
        publishedAt: {$ne: null},
      });
    }
    if (otherPermissions.length) {
      queries.push(super._limitQuery(query, otherPermissions, user));
      queries.push({
        visibility: {$in: allowedVisibilityLevels},
        defaultPermissions: {$in: otherPermissions},
      });
    }

    assert(queries.length);

    return {
      $or: queries,
    };
  }

  // We specially handle published documents and do not allow "UPDATE" permission for them.
  // We specially handle published documents and do allow "MERGE" permission only for them.
  // For other class-level permissions we behave like the user has instance-level permissions
  // on all documents for them. This is why there is no point in limiting the query based on
  // visibility and default permissions.
  static _limitQueryClassPermissions(query, permissions, user) {
    assert(user);

    // "UPDATE" permission is the only class-level permission from "permissions" the user has.
    if (!User.hasClassPermission(_.without(permissions, this.PERMISSIONS.UPDATE), user)) {
      // Documents should not be published.
      return {
        publishedAt: null,
      };
    }
    // "MERGE" permission is the only class-level permission from "permissions" the user has.
    if (!User.hasClassPermission(_.without(permissions, this.PERMISSIONS.MERGE), user)) {
      // Documents should be published.
      return {
        publishedAt: {$ne: null},
      };
    }
    else {
      return {};
    }
  }

  // Maps a document role to document permissions.
  static getPermissionsFromRole(role) {
    let permissions;
    switch (role) {
      case this.ROLES.ADMIN:
        permissions = [
          this.PERMISSIONS.VIEW, this.PERMISSIONS.COMMENT_VIEW,
          this.PERMISSIONS.COMMENT_CREATE, this.PERMISSIONS.UPDATE, this.PERMISSIONS.MERGE,
          this.PERMISSIONS.PRIVATE_COMMENT_VIEW, this.PERMISSIONS.PRIVATE_COMMENT_CREATE,
          this.PERMISSIONS.ADMIN,
        ];
        break;
      case this.ROLES.EDIT:
        permissions = [
          this.PERMISSIONS.VIEW, this.PERMISSIONS.COMMENT_VIEW,
          this.PERMISSIONS.COMMENT_CREATE, this.PERMISSIONS.UPDATE, this.PERMISSIONS.MERGE,
          this.PERMISSIONS.PRIVATE_COMMENT_VIEW, this.PERMISSIONS.PRIVATE_COMMENT_CREATE,
        ];
        break;
      case this.ROLES.COMMENT:
        permissions = [
          this.PERMISSIONS.VIEW, this.PERMISSIONS.COMMENT_VIEW,
          this.PERMISSIONS.COMMENT_CREATE,
        ];
        break;
      case this.ROLES.VIEW:
        permissions = [
          this.PERMISSIONS.VIEW, this.PERMISSIONS.COMMENT_VIEW,
        ];
        break;
      default:
        permissions = [];
        break;
    }
    return permissions;
  }

  // Maps document permissions to a document role.
  static getRoleFromPermissions(permissions) {
    let role;
    Object.keys(this.ROLES).forEach((r) => {
      const rolePermissions = this.getPermissionsFromRole(this.ROLES[r]);
      if (permissions.length === rolePermissions.length) {
        let count = 0;
        rolePermissions.forEach((p) => {
          const found = permissions.find((x) => {
            return x === p;
          });
          if (found) {
            count += 1;
          }
        });
        if (count === rolePermissions.length) {
          role = this.ROLES[r];
        }
      }
    });

    return role;
  }

  static publish(...args) {
    return callAsync('Document.publish', args);
  }

  static create(...args) {
    return callAsync('Document.create', args);
  }

  static share(...args) {
    return callAsync('Document.share', args);
  }

  static fork(...args) {
    return callAsync('Document.fork', args);
  }

  static merge(...args) {
    return callAsync('Document.merge', args);
  }
}

Document.Meta({
  name: 'Document',
  fields(fields) {
    return _.extend(fields, {
      author: Document.ReferenceField(User, User.REFERENCE_FIELDS(), false),
      publishedBy: Document.ReferenceField(User, User.REFERENCE_FIELDS(), false),
      forkedFrom: Document.ReferenceField(Document, Document.REFERENCE_FIELDS(), false),
    });
  },
});

if (Meteor.isServer) {
  Document.Meta.collection._ensureIndex({
    createdAt: 1,
  });

  Document.Meta.collection._ensureIndex({
    contentKey: 1,
  });
}
