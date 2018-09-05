import {Match} from 'meteor/check';
import {Meteor} from 'meteor/meteor';
import {Random} from 'meteor/random';
import {_} from 'meteor/underscore';

import assert from 'assert';

import {Activity} from '/lib/documents/activity';
import {Document} from '/lib/documents/document';
import {Content} from '/lib/documents/content';
import {User} from '/lib/documents/user';
import {schema} from '/lib/full-schema';
import {getPermissionObjects, filterPermissionObjects, permissionsEqual, permissionsDifference} from '/lib/utils';
import {check} from '/server/check';

Document._create = (user, connectionId) => {
  const createdAt = new Date();
  const contentKey = Random.id();

  Content.documents.insert({
    createdAt,
    contentKey,
    author: user.getReference(),
    clientId: null,
    version: 0,
    step: null,
  });

  const userPermissions = getPermissionObjects(
    Document.getPermissionsFromRole(Document.ROLES.ADMIN),
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
    defaultPermissions: Document.getPermissionsFromRole(Document.ROLES.VIEW),
  });

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

  return {
    _id: documentId,
  };
};

Document._publish = (documentId, user, connectionId) => {
  const publishedAt = new Date();

  const changed = Document.documents.update(Document.restrictQuery({
    _id: documentId,
    publishedAt: null,
  }, Document.PERMISSIONS.ADMIN, user), {
    $set: {
      publishedAt,
      publishedBy: user.getReference(),
      updatedAt: publishedAt,
      lastActivity: publishedAt,
      defaultPermissions: Document.getPermissionsFromRole(Document.ROLES.COMMENT),
      visibility: Document.VISIBILITY_LEVELS.LISTED,
    },
  });

  if (changed) {
    Activity.documents.insert({
      timestamp: publishedAt,
      connection: connectionId,
      byUser: user.getReference(),
      // We inform all followers of this document.
      // TODO: Implement once we have followers.
      forUsers: [],
      type: 'documentPublished',
      level: Activity.LEVEL.GENERAL,
      data: {
        document: {
          _id: documentId,
        },
      },
    });
  }

  return changed;
};

Document._share = (documentId, user, connectionId, visibility, defaultRole, contributors) => {
  const document = Document.documents.findOne(Document.restrictQuery({
    _id: documentId,
  }, Document.PERMISSIONS.ADMIN, user), {
    fields: Document.PERMISSIONS_FIELDS(),
  });

  if (!document) {
    throw new Meteor.Error('not-found', "Document cannot be found.");
  }

  const timestamp = new Date();

  let userPermissions = null;
  if (contributors !== null) {
    // We start with current user's permissions.
    userPermissions = filterPermissionObjects(document.userPermissions, user._id);

    contributors.forEach((contributor) => {
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
        permissionObjects = getPermissionObjects(
          Document.getPermissionsFromRole(contributor.role),
          {
            _id: contributor.userId,
          },
          timestamp,
          user.getReference(),
        );
      }

      userPermissions = userPermissions.concat(permissionObjects);
    });
  }

  let visibilityChanged = false;
  let defaultPermissionsChanged = false;
  let userPermissionsChanged = false;

  const updates = {
    updatedAt: timestamp,
    lastActivity: timestamp,
  };

  if (visibility !== null && document.visibility !== visibility) {
    updates.visibility = visibility;
    visibilityChanged = true;
  }

  // If default permissions are custom, then to keep them unchanged, "null" is passed.
  let defaultPermissions = null;
  if (defaultRole !== null) {
    defaultPermissions = Document.getPermissionsFromRole(defaultRole);
    if (!_.isEqual(_.sortBy(document.defaultPermissions || []), _.sortBy(defaultPermissions))) {
      updates.defaultPermissions = defaultPermissions;
      defaultPermissionsChanged = true;
    }
  }

  if (userPermissions !== null) {
    if (!permissionsEqual(document.userPermissions, userPermissions)) {
      updates.userPermissions = userPermissions;
      userPermissionsChanged = true;
    }
  }

  let changed = 0;
  if (visibilityChanged || defaultPermissionsChanged || userPermissionsChanged) {
    changed = Document.documents.update({
      _id: documentId,
    }, {
      $set: updates,
    });
  }

  if (changed) {
    if (visibilityChanged) {
      Activity.documents.insert({
        timestamp,
        connection: connectionId,
        byUser: user.getReference(),
        // We inform all followers of this document.
        // TODO: Implement once we have followers.
        forUsers: [],
        type: 'documentVisibilityChanged',
        level: Activity.LEVEL.ADMIN,
        data: {
          visibility,
          document: {
            _id: documentId,
          },
        },
      });
    }

    if (defaultPermissionsChanged) {
      Activity.documents.insert({
        timestamp,
        connection: connectionId,
        byUser: user.getReference(),
        // We inform all followers of this document.
        // TODO: Implement once we have followers.
        forUsers: [],
        type: 'documentDefaultPermissionsChanged',
        level: Activity.LEVEL.ADMIN,
        data: {
          defaultPermissions,
          document: {
            _id: documentId,
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
            connection: connectionId,
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
                _id: documentId,
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
            connection: connectionId,
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
                _id: documentId,
              },
              permission: permission.permission,
            },
          });
        });
      });
    }
  }

  return changed;
};

Meteor.methods({
  'Document.publish'(args) {
    check(args, {
      documentId: Match.DocumentId,
    });

    if (Meteor.settings.public.apiControlled) {
      throw new Meteor.Error('forbidden', "Method disabled.");
    }

    const user = Meteor.user(_.extend(User.REFERENCE_FIELDS(), User.CHECK_PERMISSIONS_FIELDS()));

    return Document._publish(args.documentId, user, (this.connection && this.connection.id) || null);
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

    if (Meteor.settings.public.apiControlled) {
      throw new Meteor.Error('forbidden', "Method disabled.");
    }

    const user = Meteor.user(_.extend(User.REFERENCE_FIELDS(), User.CHECK_PERMISSIONS_FIELDS()));

    return Document._share(args.documentId, user, (this.connection && this.connection.id) || null, args.visibility, args.defaultRole, args.contributors);
  },

  'Document.create'(args) {
    check(args, {});

    if (Meteor.settings.public.apiControlled) {
      throw new Meteor.Error('forbidden', "Method disabled.");
    }

    const user = Meteor.user(_.extend(User.REFERENCE_FIELDS(), User.CHECK_PERMISSIONS_FIELDS()));

    // We check that the user has a class-level permission to create documents.
    if (!User.hasClassPermission(Document.PERMISSIONS.CREATE, user)) {
      throw new Meteor.Error('unauthorized', "Unauthorized.");
    }

    // We need a user reference.
    assert(user);

    return Document._create(user, (this.connection && this.connection.id) || null);
  },
});

Meteor.publish('Document.list', function documentList(args) {
  check(args, {});

  this.enableScope();

  this.autorun((computation) => {
    return Document.documents.find(Document.restrictQuery({}, Document.PERMISSIONS.VIEW), {
      fields: Document.PUBLISH_FIELDS(),
    });
  });
});

Meteor.publish('Document.one', function documentOne(args) {
  check(args, {
    documentId: Match.DocumentId,
  });

  this.autorun((computation) => {
    return Document.documents.find(Document.restrictQuery({
      _id: args.documentId,
    }, Document.PERMISSIONS.VIEW), {
      fields: Document.PUBLISH_FIELDS(),
    });
  });
});

// This publish endpoint does not restrict "userPermissions" on purpose.
Meteor.publish('Document.admin', function documentAdmin(args) {
  check(args, {
    documentId: Match.DocumentId,
  });

  this.autorun((computation) => {
    return Document.documents.find(Document.restrictQuery({
      _id: args.documentId,
    }, Document.PERMISSIONS.ADMIN), {
      // "PUBLISH_FIELDS" already contains all fields we are interested in,
      // we just do not restrict "userPermissions".
      fields: Document.PUBLISH_FIELDS(),
    });
  });
});

// For testing.
export {Document};
