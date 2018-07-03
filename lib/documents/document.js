import {check} from 'meteor/check';
import {Meteor} from 'meteor/meteor';
import {_} from 'meteor/underscore';

import {ValidatedMethod} from 'meteor/mdg:validated-method';

import {BaseDocument} from '../base';
import {method} from '../utils';
import {Activity} from './activity';
import {Content} from './content';
import {User} from './user';
import {schema} from "../full-schema";

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
  // userPermissions [
  //  {
  //    user: { _id }
  //    addedAt
  //    addedBy: { _id }
  //    permission
  //  }
  // ]
  // visibility: Document visibility level (Private, Public or Listed)

  static PUBLISH_FIELDS() {
    return _.extend(super.PUBLISH_FIELDS(), {
      _id: 1,
      createdAt: 1,
      publishedAt: 1,
      title: 1,
      contentKey: 1,
      userPermissions: 1,
      visibility: 1,
    });
  }

  isPublished() {
    return !!this.publishedAt;
  }

  static _create(user, connectionId) {
    const createdAt = new Date();
    const contentKey = Content.Meta.collection._makeNewID();

    Content.documents.insert({
      createdAt,
      contentKey,
      author: user.getReference(),
      clientId: null,
      version: 0,
      step: null,
    });

    const userPermissions = Document.getUserPermissions('admin', user.getReference(), createdAt, user.getReference());

    const documentId = Document.documents.insert({
      contentKey,
      createdAt,
      updatedAt: createdAt,
      lastActivity: createdAt,
      author: user.getReference(),
      publishedBy: null,
      publishedAt: null,
      title: '',
      version: 0,
      body: schema.topNodeType.createAndFill().toJSON(),
      userPermissions,
      visibility: Document.VISIBILITY_LEVELS.PRIVATE,
    });

    if (Meteor.isServer) {
      // TODO: Improve once we really have groups.
      const groupUsers = User.documents.find({}, {
        fields: User.REFERENCE_FIELDS(),
        transform: null,
      }).fetch();

      Activity.documents.insert({
        timestamp: createdAt,
        connection: connectionId,
        byUser: user.getReference(),
        // We inform all users in this group.
        forUsers: groupUsers,
        type: 'documentCreated',
        level: Activity.LEVEL.GENERAL,
        data: {
          document: {
            _id: documentId,
          },
        },
      });
    }

    return {
      _id: documentId,
    };
  }
}

Document.Meta({
  name: 'Document',
  fields(fields) {
    return _.extend(fields, {
      author: Document.ReferenceField(User, User.REFERENCE_FIELDS()),
      publishedBy: Document.ReferenceField(User, User.REFERENCE_FIELDS(), false),
    });
  },
});

Document.PERMISSIONS = {
  // We use upper case even for strings because we are using upper case for permissions and lower case for roles.
  SEE: 'DOCUMENT_SEE',
  CREATE: 'DOCUMENT_CREATE',
  CREATE_API: 'DOCUMENT_CREATE_API',
  ADMIN: 'DOCUMENT_ADMIN',
  ADMIN_API: 'DOCUMENT_ADMIN_API',
  UPDATE: 'DOCUMENT_UPDATE',
  COMMENT_SEE: 'DOCUMENT_COMMENT_SEE',
  COMMENT_CREATE: 'DOCUMENT_COMMENT_CREATE',
  PRIVATE_COMMENT_SEE: 'DOCUMENT_PRIVATE_COMMENT_SEE',
  PRIVATE_COMMENT_CREATE: 'DOCUMENT_PRIVATE_COMMENT_CREATE',
};

Document.ROLES = {
  ADMIN: 'admin',
  EDIT: 'edit',
  SEE: 'see',
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
      permissions = [Document.PERMISSIONS.SEE, Document.PERMISSIONS.UPDATE, Document.PERMISSIONS.ADMIN,
        Document.PERMISSIONS.PRIVATE_COMMENT_SEE, Document.PERMISSIONS.PRIVATE_COMMENT_CREATE];
      break;
    case Document.ROLES.EDIT:
      permissions = [Document.PERMISSIONS.SEE, Document.PERMISSIONS.UPDATE,
        Document.PERMISSIONS.PRIVATE_COMMENT_SEE, Document.PERMISSIONS.PRIVATE_COMMENT_CREATE];
      break;
    case Document.ROLES.SEE:
      permissions = [Document.PERMISSIONS.SEE];
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
  permissions.forEach((p) => {
    userPermissions.push({
      user,
      addedAt,
      addedBy,
      permission: p,
    });
  });
  return userPermissions;
};

Document.create = method(new ValidatedMethod({
  name: 'Document.create',

  validate(args) {
    check(args, {});
  },

  // eslint-disable-next-line no-empty-pattern
  run({}) {
    const user = Meteor.user(User.REFERENCE_FIELDS());

    // We need user reference.
    if (!user || !user.hasPermission(Document.PERMISSIONS.CREATE)) {
      throw new Meteor.Error('unauthorized', "Unauthorized.");
    }

    return Document._create(user, (this.connection && this.connection.id) || null);
  },
}));

Document.publish = function publish(...args) {
  args.unshift('Document.publish');
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
