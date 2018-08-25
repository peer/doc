import {check, Match} from 'meteor/check';
import {Meteor} from 'meteor/meteor';
import {_} from 'meteor/underscore';

import {Activity} from '/lib/documents/activity';
import {Document} from '/lib/documents/document';
import {Content} from '/lib/documents/content';
import {User} from '/lib/documents/user';
import {schema} from "/lib/full-schema";

Document._create = (user, connectionId) => {
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

  const userPermissions = Document.getPermissionObjects(
    Document.getRolePermissions(Document.ROLES.ADMIN),
    user.getReference(),
    createdAt,
    user.getReference(),
  );

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
    defaultPermissions: Document.getRolePermissions(Document.ROLES.VIEW),
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
};

function filterPermissionObjects(userPermissions, userId) {
  return (userPermissions || []).filter((userPermission) => {
    return userPermission.user._id === userId;
  });
}

function stringCmp(string1, string2) {
  if (string1 === string2) {
    return 0;
  }
  else if (string1 < string2) {
    return -1;
  }
  else {
    return 1;
  }
}

function sortedLitePermissions(userPermissions) {
  return (userPermissions || []).map((userPermission) => {
    return {
      userId: userPermission.user._id,
      permission: userPermission.permission,
    };
  }).sort((userPermission1, userPermission2) => {
    let cmp = stringCmp(userPermission1.userId, userPermission2.userId);

    if (cmp === 0) {
      cmp = stringCmp(userPermission1.permission, userPermission2.permission);
    }

    return cmp;
  });
}

function permissionsEqual(userPermissions1, userPermissions2) {
  return _.isEqual(sortedLitePermissions(userPermissions1), sortedLitePermissions(userPermissions2));
}

// User permissions in "userPermissions1" which are not in "userPermissions2".
function permissionsDifference(userPermissions1, userPermissions2) {
  return (userPermissions1 || []).filter((userPermission1) => {
    return !(userPermissions2 || []).find((userPermission2) => {
      return (userPermission1.permission === userPermission2.permission) && (userPermission1.user._id === userPermission2.user._id);
    });
  });
}

Meteor.methods({
  'Document.publish'(args) {
    check(args, {
      documentId: Match.DocumentId,
    });

    const user = Meteor.user(User.REFERENCE_FIELDS());

    const publishedAt = new Date();

    const changed = Document.documents.update(Document.restrictQuery({
      _id: args.documentId,
    }, Document.PERMISSIONS.ADMIN, user), {
      $set: {
        publishedAt,
        updatedAt: publishedAt,
        lastActivity: publishedAt,
        publishedBy: user.getReference(),
      },
    });

    if (changed) {
      Activity.documents.insert({
        timestamp: publishedAt,
        connection: this.connection.id,
        byUser: user.getReference(),
        // We inform all followers of this document.
        // TODO: Implement once we have followers.
        forUsers: [],
        type: 'documentPublished',
        level: Activity.LEVEL.GENERAL,
        data: {
          document: {
            _id: args.documentId,
          },
        },
      });
    }
  },

  'Document.share'(args) {
    check(args, {
      documentId: Match.DocumentId,
      visibility: Match.Enumeration(Match.NonEmptyString, Document.VISIBILITY_LEVELS),
      defaultRole: Match.OptionalOrNull(Match.Enumeration(Match.NonEmptyString, _.omit(Document.ROLES, 'ADMIN'))),
      contributors: [
        {
          userId: Match.DocumentId,
          role: Match.OptionalOrNull(Match.Enumeration(Match.NonEmptyString, Document.ROLES)),
        },
      ],
    });

    const user = Meteor.user();
    const document = Document.documents.findOne({
      _id: args.documentId,
    }, {
      fields: _.extend(Document.PERMISSIONS_FIELDS(), {
        // Additional fields so that we can check what changed.
        visibility: 1,
        defaultPermissions: 1,
        userPermissions: 1,
      }),
    });

    if (!document || !document.canUser(Document.PERMISSIONS.ADMIN, user)) {
      throw new Meteor.Error('not-found', "Not found.");
    }

    const timestamp = new Date();

    // We start with current user's permissions.
    let userPermissions = filterPermissionObjects(document.userPermissions, user._id);

    args.contributors.forEach((contributor) => {
      let permissionObjects;

      // We allow each contributor to be listed only once.
      // This also handles the case that the user cannot change their own permissions
      // because we start with permissions for the current user.
      if (userPermissions.find((userPermission) => {
        return userPermission.user._id === contributor.userId;
      })) {
        // Skip.
        return;
      }
      // If "role" is "null", we keep existing permissions (so that we can keep custom permissions).
      else if (contributor.role === null) {
        permissionObjects = filterPermissionObjects(document.userPermissions, contributor.userId);
      }
      else {
        permissionObjects = Document.getPermissionObjects(
          Document.getRolePermissions(contributor.role),
          {
            _id: contributor.userId,
          },
          timestamp,
          user.getReference(),
        );
      }

      userPermissions = userPermissions.concat(permissionObjects);
    });

    let visibilityChanged = false;
    let defaultPermissionsChanged = false;
    let userPermissionsChanged = false;

    const updates = {
      updatedAt: timestamp,
      lastActivity: timestamp,
    };

    if (document.visibility !== args.visibility) {
      updates.visibility = args.visibility;
      visibilityChanged = true;
    }

    // If default permissions are custom, then to keep them unchanged, "null" is passed.
    let defaultPermissions = null;
    if (args.defaultRole !== null) {
      defaultPermissions = Document.getRolePermissions(args.defaultRole);
      if (!_.isEqual(_.sortBy(document.defaultPermissions || []), _.sortBy(defaultPermissions))) {
        updates.defaultPermissions = defaultPermissions;
        defaultPermissionsChanged = true;
      }
    }

    if (!permissionsEqual(document.userPermissions, userPermissions)) {
      updates.userPermissions = userPermissions;
      userPermissionsChanged = true;
    }

    let changed = 0;
    if (visibilityChanged || defaultPermissionsChanged || userPermissionsChanged) {
      changed = Document.documents.update({
        _id: args.documentId,
      }, {
        $set: updates,
      });
    }

    if (changed) {
      if (visibilityChanged) {
        Activity.documents.insert({
          timestamp,
          connection: this.connection.id,
          byUser: user.getReference(),
          // We inform all followers of this document.
          // TODO: Implement once we have followers.
          forUsers: [],
          type: 'documentVisibilityChanged',
          level: Activity.LEVEL.ADMIN,
          data: {
            document: {
              _id: args.documentId,
            },
            visibility: args.visibility,
          },
        });
      }

      if (defaultPermissionsChanged) {
        Activity.documents.insert({
          timestamp,
          connection: this.connection.id,
          byUser: user.getReference(),
          // We inform all followers of this document.
          // TODO: Implement once we have followers.
          forUsers: [],
          type: 'documentDefaultPermissionsChanged',
          level: Activity.LEVEL.ADMIN,
          data: {
            defaultPermissions,
            document: {
              _id: args.documentId,
            },
          },
        });
      }

      if (userPermissionsChanged) {
        const newPermissionsByUsers = _.groupBy(userPermissions, (userPermission) => {
          return userPermission.user._id;
        });
        const oldPermissionsByUsers = _.groupBy(document.userPermissions || [], (userPermission) => {
          return userPermission.user._id;
        });

        _.each(newPermissionsByUsers, (permissionsByUser, userId) => {
          const newPermissions = permissionsDifference(permissionsByUser, oldPermissionsByUsers[userId]);

          _.each(newPermissions, (permission) => {
            Activity.documents.insert({
              timestamp,
              connection: this.connection.id,
              byUser: user.getReference(),
              forUsers: [
                {
                  _id: permission.user._id,
                },
              ],
              type: 'documentPermissionAdded',
              level: Activity.LEVEL.ADMIN,
              data: {
                document: {
                  _id: args.documentId,
                },
                permission: permission.permission,
              },
            });
          });
        });

        _.each(oldPermissionsByUsers, (permissionsByUser, userId) => {
          const oldPermissions = permissionsDifference(permissionsByUser, newPermissionsByUsers[userId]);

          _.each(oldPermissions, (permission) => {
            Activity.documents.insert({
              timestamp,
              connection: this.connection.id,
              byUser: user.getReference(),
              forUsers: [
                {
                  _id: permission.user._id,
                },
              ],
              type: 'documentPermissionRemoved',
              level: Activity.LEVEL.ADMIN,
              data: {
                document: {
                  _id: args.documentId,
                },
                permission: permission.permission,
              },
            });
          });
        });
      }
    }

    return changed;
  },

  'Document.create'(args) {
    check(args, {});
    const user = Meteor.user(User.REFERENCE_FIELDS());

    // We need user reference.
    if (!user || !user.hasPermission(Document.PERMISSIONS.CREATE)) {
      throw new Meteor.Error('unauthorized', "Unauthorized.");
    }

    return Document._create(user, (this.connection && this.connection.id) || null);
  },
});

Meteor.publish('Document.list', function documentList(args) {
  check(args, {});

  this.enableScope();

  this.autorun((computation) => {
    // TODO: Show unpublished documents to users with UPDATE permission.
    // TODO: Show public drafts to users.
    return Document.documents.find(Document.restrictQuery({
      $or: [{publishedAt: {$ne: null}}, {visibility: Document.VISIBILITY_LEVELS.LISTED}],
    }, Document.PERMISSIONS.VIEW), {
      fields: Document.PUBLISH_FIELDS(),
    });
  });
});

Meteor.publish('Document.one', function documentOne(args) {
  check(args, {
    documentId: Match.DocumentId,
  });

  const self = this;
  const user = Meteor.user(User.REFERENCE_FIELDS());

  this.autorun((computation) => {
    if (user) {
      const fields = Document.PUBLISH_FIELDS();
      fields.userPermissions = 1;
      const handle = Document.documents.find(Document.restrictQuery({
        _id: args.documentId,
      }, [], user, {$and: [{$or: [{visibility: {$ne: Document.VISIBILITY_LEVELS.PRIVATE}}, {userPermissions: {$elemMatch: {'user._id': user._id, permission: Document.PERMISSIONS.VIEW}}}]}]}), {
        fields,
      }).observeChanges({
        added(id, documentFields) {
          const userPermissions = documentFields.userPermissions.filter((x) => {
            return x.user._id === user._id;
          });
          self.added('Documents', id, Object.assign({}, documentFields, {
            userPermissions,
          }));
        },
      });
      self.onStop(() => {
        handle.stop();
      });
      return self.ready();
    }
    else {
      return Document.documents.find({
        _id: args.documentId,
        visibility: {$ne: Document.VISIBILITY_LEVELS.PRIVATE},
      }, {
        fields: Document.PUBLISH_FIELDS(),
      });
    }
  });
});

Meteor.publish('Document.admin', function documentadmin(args) {
  check(args, {
    documentId: Match.DocumentId,
  });

  const user = Meteor.user(User.REFERENCE_FIELDS());
  const adminFields = Document.PUBLISH_FIELDS();
  adminFields.userPermissions = 1;
  adminFields.defaultPermissions = 1;

  this.autorun((computation) => {
    return Document.documents.find(Document.restrictQuery({
      _id: args.documentId,
    }, [], user, {$and: [{userPermissions: {$elemMatch: {'user._id': user._id, permission: Document.PERMISSIONS.ADMIN}}}]}), {
      fields: adminFields,
    });
  });
});

// For testing.
export {Document};
