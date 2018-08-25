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
    });
  }

  isPublished() {
    return !!this.publishedAt;
  }

  static _restrictQueryForAnonymousUser(query, permissions) {
    // An anonymous user can only view things.
    const anonymousPermissions = _.intersection(permissions, Document.getRolePermissions(Document.ROLES.VIEW));

    return {
      $and: [
        query,
        {
          // We specially handle only public and listed documents.
          visibility: {$in: [Document.VISIBILITY_LEVELS.PUBLIC, Document.VISIBILITY_LEVELS.LISTED]},
          defaultPermissions: {$in: anonymousPermissions},
        },
      ],
    };
  }

  static _restrictQuery(permissions, user) {
    assert(user);

    return {
      $or: [
        super._restrictQuery(permissions, user),
        {
          // We specially handle only public and listed documents.
          visibility: {$in: [Document.VISIBILITY_LEVELS.PUBLIC, Document.VISIBILITY_LEVELS.LISTED]},
          defaultPermissions: {$in: permissions},
        },
      ],
    };
  }

  _canUser(permissions, user) {
    assert(user);

    // We specially handle only public and listed documents. We check it in this way to handle
    // also the case that "this.visibility" might be some unknown value, or even not set.
    if (this.visibility !== Document.VISIBILITY_LEVELS.PUBLIC && this.visibility !== Document.VISIBILITY_LEVELS.LISTED) {
      return false;
    }

    return !!_.intersection(this.defaultPermissions, permissions).length;
  }

  _canAnonymousUser(permissions) {
    // We specially handle only public and listed documents. We check it in this way to handle
    // also the case that "this.visibility" might be some unknown value, or even not set.
    if (this.visibility !== Document.VISIBILITY_LEVELS.PUBLIC && this.visibility !== Document.VISIBILITY_LEVELS.LISTED) {
      return false;
    }

    // An anonymous user can only view things.
    const anonymousPermissions = _.intersection(permissions, Document.getRolePermissions(Document.ROLES.VIEW));

    return !!_.intersection(this.defaultPermissions, anonymousPermissions).length;
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
