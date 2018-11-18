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
  // rebasedAtVersion: version to which this document was last rebased from the parent document;
  //                   when this value changes, anything which is remembering steps has to re-read
  //                   them all because they might have been rewritten/changed;
  //                   moreover, when existing steps change, this field always changes because the
  //                   only reason we are currently changing existing steps is to rebase which has
  //                   to add more steps from the parent since the last "rebasedAtVersion",
  //                   thus "rebasedAtVersion" has to change/increase
  // hasContentAppendLock: not null if document's content is having steps appended to;
  //                       set to a timestamp when lock has been acquired;
  //                       we use two locks because this lock does not make editor read-only
  //                       in clients
  // hasContentModifyLock: not null if document's content is having content modified (steps
  //                       rebased, merged); set to a timestamp when lock has been acquired
  // mergeAcceptedBy:
  //   _id
  //   username
  //   avatar
  // mergeAcceptedAt: time when document was merged into the parent document
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
      author: 1,
      publishedAt: 1,
      publishedBy: 1,
      mergeAcceptedAt: 1,
      mergeAcceptedBy: 1,
      title: 1,
      contentKey: 1,
      forkedFrom: 1,
      rebasedAtVersion: 1,
      hasContentModifyLock: 1,
    });
  }

  static PERMISSIONS_FIELDS() {
    return _.extend(super.PERMISSIONS_FIELDS(), {
      visibility: 1,
      defaultPermissions: 1,
      publishedAt: 1,
      mergeAcceptedAt: 1,
    });
  }

  // TODO: Add "SUGGEST_MERGE" permission.
  static PERMISSIONS = {
    // We use upper case even for strings because we are using upper case for permissions and lower case for roles.
    VIEW: 'DOCUMENT_VIEW',
    CREATE: 'DOCUMENT_CREATE',
    UPDATE: 'DOCUMENT_UPDATE',
    PUBLISH: 'DOCUMENT_PUBLISH',
    // This permission is about accepting a merge from document's fork into the current document.
    ACCEPT_MERGE: 'DOCUMENT_ACCEPT_MERGE',
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

  isMergeAccepted() {
    return !!this.mergeAcceptedAt;
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

    // "UPDATE", "PUBLISH", and "ACCEPT_MERGE" permissions should not be among these permissions because we do not
    // have any special logic in this method to handle documents based on their published and merged status.
    // Moreover, their actions require attribution to be stored, so anonymous users cannot have these permissions.
    assert(!_.contains(anonymousPermissions, this.PERMISSIONS.UPDATE));
    assert(!_.contains(anonymousPermissions, this.PERMISSIONS.PUBLISH));
    assert(!_.contains(anonymousPermissions, this.PERMISSIONS.ACCEPT_MERGE));

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

  // We specially handle documents on their published and merged status for permissions
  // "UPDATE", "PUBLISH", and "ACCEPT_MERGE". We specially handle public and listed
  // documents. We return public documents using default permissions only if the query
  // explicitly specifies them by their IDs. On the other hand, we do not care about
  // the type of query if the user has instance-level permissions on documents.
  static _limitQuery(query, permissions, user) {
    assert(user);

    const updatePermissions = _.intersection(permissions, [this.PERMISSIONS.UPDATE]);
    const publishPermissions = _.intersection(permissions, [this.PERMISSIONS.PUBLISH]);
    const acceptMergePermissions = _.intersection(permissions, [this.PERMISSIONS.ACCEPT_MERGE]);
    const otherPermissions = _.without(permissions, this.PERMISSIONS.UPDATE, this.PERMISSIONS.PUBLISH, this.PERMISSIONS.ACCEPT_MERGE);

    const allowedVisibilityLevels = this._getAllowedVisibilityLevels(query);

    const queries = [];

    // Document can be updated only if it has not been published or merged into the parent.
    if (updatePermissions.length) {
      queries.push({
        $and: [
          super._limitQuery(query, updatePermissions, user),
          {
            publishedAt: null,
            mergeAcceptedAt: null,
          },
        ],
      });
      queries.push({
        visibility: {$in: allowedVisibilityLevels},
        defaultPermissions: {$in: updatePermissions},
        publishedAt: null,
        mergeAcceptedAt: null,
      });
    }
    // Document can be published only if it has not yet been published or merged into the parent.
    if (publishPermissions.length) {
      queries.push({
        $and: [
          super._limitQuery(query, publishPermissions, user),
          {
            publishedAt: null,
            mergeAcceptedAt: null,
          },
        ],
      });
      queries.push({
        visibility: {$in: allowedVisibilityLevels},
        defaultPermissions: {$in: publishPermissions},
        publishedAt: null,
        mergeAcceptedAt: null,
      });
    }
    // Merging into the current document can be accepted only if the document is published
    // and has not been merged into its own parent document. It can be configured to allow
    // merging also if the current document is not published.
    if (acceptMergePermissions.length) {
      if (Meteor.settings.public.mergingForkingOfAllDocuments) {
        queries.push({
          $and: [
            super._limitQuery(query, acceptMergePermissions, user),
            {
              mergeAcceptedAt: null,
            },
          ],
        });
        queries.push({
          visibility: {$in: allowedVisibilityLevels},
          defaultPermissions: {$in: acceptMergePermissions},
          mergeAcceptedAt: null,
        });
      }
      else {
        queries.push({
          $and: [
            super._limitQuery(query, acceptMergePermissions, user),
            {
              publishedAt: {$ne: null},
              mergeAcceptedAt: null,
            },
          ],
        });
        queries.push({
          visibility: {$in: allowedVisibilityLevels},
          defaultPermissions: {$in: acceptMergePermissions},
          publishedAt: {$ne: null},
          mergeAcceptedAt: null,
        });
      }
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

  // We specially handle documents on their published and merged status for permissions
  // "UPDATE", "PUBLISH", and "ACCEPT_MERGE". For other class-level permissions we
  // behave like the user has instance-level permissions on all documents for them.
  // This is why there is no point in limiting the query based on visibility and default
  // permissions.
  static _limitQueryClassPermissions(query, permissions, user) {
    assert(user);

    const updatePermissions = _.intersection(permissions, [this.PERMISSIONS.UPDATE]);
    const publishPermissions = _.intersection(permissions, [this.PERMISSIONS.PUBLISH]);
    const acceptMergePermissions = _.intersection(permissions, [this.PERMISSIONS.ACCEPT_MERGE]);
    const otherPermissions = _.without(permissions, this.PERMISSIONS.UPDATE, this.PERMISSIONS.PUBLISH, this.PERMISSIONS.ACCEPT_MERGE);

    // User has also some other class-level permission.
    if (User.hasClassPermission(otherPermissions, user)) {
      // In this case there is no additional restrictions.
      return {};
    }
    else {
      const queries = [];

      if (User.hasClassPermission(updatePermissions, user)) {
        queries.push({
          publishedAt: null,
          mergeAcceptedAt: null,
        });
      }
      if (User.hasClassPermission(publishPermissions, user)) {
        queries.push({
          publishedAt: null,
          mergeAcceptedAt: null,
        });
      }
      if (User.hasClassPermission(acceptMergePermissions, user)) {
        queries.push({
          publishedAt: {$ne: null},
          mergeAcceptedAt: null,
        });
      }

      if (queries.length) {
        return {
          $or: queries,
        };
      }
      else {
        return {};
      }
    }
  }

  // Maps a document role to document permissions.
  static getPermissionsFromRole(role) {
    let permissions;
    switch (role) {
      case this.ROLES.ADMIN:
        permissions = [
          this.PERMISSIONS.VIEW, this.PERMISSIONS.COMMENT_VIEW,
          this.PERMISSIONS.COMMENT_CREATE, this.PERMISSIONS.UPDATE, this.PERMISSIONS.PUBLISH, this.PERMISSIONS.ACCEPT_MERGE,
          this.PERMISSIONS.PRIVATE_COMMENT_VIEW, this.PERMISSIONS.PRIVATE_COMMENT_CREATE,
          this.PERMISSIONS.ADMIN,
        ];
        break;
      case this.ROLES.EDIT:
        permissions = [
          this.PERMISSIONS.VIEW, this.PERMISSIONS.COMMENT_VIEW,
          this.PERMISSIONS.COMMENT_CREATE, this.PERMISSIONS.UPDATE,
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

  static acceptMerge(...args) {
    return callAsync('Document.acceptMerge', args);
  }
}

Document.Meta({
  name: 'Document',
  fields(fields) {
    return _.extend(fields, {
      author: Document.ReferenceField(User, User.REFERENCE_FIELDS(), false),
      publishedBy: Document.ReferenceField(User, User.REFERENCE_FIELDS(), false),
      mergeAcceptedBy: Document.ReferenceField(User, User.REFERENCE_FIELDS(), false),
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
