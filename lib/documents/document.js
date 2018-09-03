import {Meteor} from 'meteor/meteor';
import {_} from 'meteor/underscore';

import assert from 'assert';

import {BasePermissionedDocument} from '../base';
import {User} from './user';

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
    });
  }

  static PERMISSIONS_FIELDS() {
    return _.extend(super.PERMISSIONS_FIELDS(), {
      visibility: 1,
      defaultPermissions: 1,
      publishedAt: 1,
    });
  }

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
    const anonymousPermissions = _.intersection(permissions, this.getRolePermissions(this.ROLES.VIEW));

    // "UPDATE" permission should not be among these permissions because we
    // are not handling published documents in this method.
    assert(!_.contains(anonymousPermissions, this.PERMISSIONS.UPDATE));

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
  // We specially handle public and listed documents. We return public documents using
  // default permissions only if the query explicitly specifies them by their IDs. On
  // the other hand, we do not care about the type of query if the user has instance-level
  // permissions on documents.
  static _limitQuery(query, permissions, user) {
    assert(user);

    const updatePermissions = _.intersection(permissions, [this.PERMISSIONS.UPDATE]);
    const otherPermissions = _.without(permissions, this.PERMISSIONS.UPDATE);

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
    else {
      return {};
    }
  }
}

Document.Meta({
  name: 'Document',
  fields(fields) {
    return _.extend(fields, {
      author: Document.ReferenceField(User, User.REFERENCE_FIELDS(), false),
      publishedBy: Document.ReferenceField(User, User.REFERENCE_FIELDS(), false),
    });
  },
});

Document.PERMISSIONS = {
  // We use upper case even for strings because we are using upper case for permissions and lower case for roles.
  VIEW: 'DOCUMENT_VIEW',
  CREATE: 'DOCUMENT_CREATE',
  UPDATE: 'DOCUMENT_UPDATE',
  ADMIN: 'DOCUMENT_ADMIN',
  COMMENT_VIEW: 'DOCUMENT_COMMENT_VIEW',
  COMMENT_CREATE: 'DOCUMENT_COMMENT_CREATE',
  PRIVATE_COMMENT_VIEW: 'DOCUMENT_PRIVATE_COMMENT_VIEW',
  PRIVATE_COMMENT_CREATE: 'DOCUMENT_PRIVATE_COMMENT_CREATE',
};

Document.ROLES = {
  VIEW: 'view',
  COMMENT: 'comment',
  EDIT: 'edit',
  ADMIN: 'admin',
};

Document.VISIBILITY_LEVELS = {
  PRIVATE: 'private',
  PUBLIC: 'public',
  LISTED: 'listed',
};

// Maps a document role to document permissions.
Document.getRolePermissions = (role) => {
  let permissions;
  switch (role) {
    case Document.ROLES.ADMIN:
      permissions = [
        Document.PERMISSIONS.VIEW, Document.PERMISSIONS.COMMENT_VIEW,
        Document.PERMISSIONS.COMMENT_CREATE, Document.PERMISSIONS.UPDATE,
        Document.PERMISSIONS.PRIVATE_COMMENT_VIEW, Document.PERMISSIONS.PRIVATE_COMMENT_CREATE,
        Document.PERMISSIONS.ADMIN,
      ];
      break;
    case Document.ROLES.EDIT:
      permissions = [
        Document.PERMISSIONS.VIEW, Document.PERMISSIONS.COMMENT_VIEW,
        Document.PERMISSIONS.COMMENT_CREATE, Document.PERMISSIONS.UPDATE,
        Document.PERMISSIONS.PRIVATE_COMMENT_VIEW, Document.PERMISSIONS.PRIVATE_COMMENT_CREATE,
      ];
      break;
    case Document.ROLES.COMMENT:
      permissions = [
        Document.PERMISSIONS.VIEW, Document.PERMISSIONS.COMMENT_VIEW,
        Document.PERMISSIONS.COMMENT_CREATE,
      ];
      break;
    case Document.ROLES.VIEW:
      permissions = [
        Document.PERMISSIONS.VIEW, Document.PERMISSIONS.COMMENT_VIEW,
      ];
      break;
    default:
      permissions = [];
      break;
  }
  return permissions;
};

// Maps document permissions to a document role.
Document.getRoleFromPermissions = (permissions) => {
  let role;
  Object.keys(Document.ROLES).forEach((r) => {
    const rolePermissions = Document.getRolePermissions(Document.ROLES[r]);
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
        role = Document.ROLES[r];
      }
    }
  });

  return role;
};

// Returns a list of permission objects given a specific user and permissions.
Document.getPermissionObjects = (permissions, user, addedAt, addedBy) => {
  const userPermissions = [];
  // For each permission add a userPermission object to the list.
  permissions.forEach((permission) => {
    userPermissions.push({
      user,
      addedAt,
      addedBy,
      permission,
    });
  });
  return userPermissions;
};

Document.publish = function publish(...args) {
  args.unshift('Document.publish');
  return Meteor.call(...args);
};

Document.create = function create(...args) {
  args.unshift('Document.create');
  return Meteor.call(...args);
};

Document.share = function share(...args) {
  args.unshift('Document.share');
  return Meteor.call(...args);
};

if (Meteor.isServer) {
  Document.Meta.collection._ensureIndex({
    createdAt: 1,
  });

  Document.Meta.collection._ensureIndex({
    contentKey: 1,
  });
}
