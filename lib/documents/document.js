import {Meteor} from 'meteor/meteor';
import {_} from 'meteor/underscore';

import {BaseDocument} from '../base';
import {User} from './user';

export class Document extends BaseDocument {
  // createdAt: time of document creation
  // updatedAt: time of the last change
  // lastActivity: time of the last activity on the document
  // author:
  //   _id
  //   username
  //   avatar
  // publishedBy:
  //  _id
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
      visibility: 1,
    });
  }

  isPublished() {
    return !!this.publishedAt;
  }

  canUser(permissions, user) {
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
      return false;
    }

    let hasAllPermissions = true;

    permissions.forEach((x) => {
      const found = this.userPermissions && this.userPermissions.find((y) => {
        return user && y.user._id === user._id && y.permission === x;
      });
      if (!found) {
        hasAllPermissions = false;
      }
    });

    return hasAllPermissions;
  }
}

Document.Meta({
  name: 'Document',
  fields(fields) {
    return _.extend(fields, {
      author: Document.ReferenceField(User, User.REFERENCE_FIELDS(), false),
      publishedBy: Document.ReferenceField(User, User.REFERENCE_FIELDS(), false),
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

Document.PERMISSIONS = {
  // We use upper case even for strings because we are using upper case for permissions and lower case for roles.
  VIEW: 'DOCUMENT_VIEW',
  CREATE: 'DOCUMENT_CREATE',
  CREATE_API: 'DOCUMENT_CREATE_API',
  ADMIN: 'DOCUMENT_ADMIN',
  ADMIN_API: 'DOCUMENT_ADMIN_API',
  UPDATE: 'DOCUMENT_UPDATE',
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
Document.getRoleByPermissions = (permissions) => {
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

// Returns a list of userPermission objects given a specific user and role.
Document.getUserPermissions = (role, user, addedAt, addedBy) => {
  // Get the permissions of the given role.
  const permissions = Document.getRolePermissions(role);
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
