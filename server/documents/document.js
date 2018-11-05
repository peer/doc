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

function insertNewDocument(user, connectionId, createdAt, contentKey, doc) {
  const userPermissions = getPermissionObjects(
    Document.getPermissionsFromRole(Document.ROLES.ADMIN),
    user.getReference(),
    createdAt,
    user.getReference(),
  );

  const toCreate = {
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
    status: Document.STATUS.CREATED,
  };

  const documentBody = doc ? Object.assign({}, toCreate, doc) : toCreate;

  const documentId = Document.documents.insert(documentBody);

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
  return documentId;
}


Document._create = function create(args, user, connectionId) {
  check(args, {});

  // We check that the user has a class-level permission to create documents.
  if (!User.hasClassPermission(this.PERMISSIONS.CREATE, user)) {
    throw new Meteor.Error('unauthorized', "Unauthorized.");
  }

  // We need a user reference.
  assert(user);

  const createdAt = new Date();
  const contentKey = Random.id();

  Content.documents.insert({
    createdAt,
    author: user.getReference(),
    clientId: null,
    contentKeys: [contentKey],
    version: 0,
    step: null,
  });

  const documentId = insertNewDocument(user, connectionId, createdAt, contentKey);
  return {
    contentKey,
    _id: documentId,
  };
};

Document._publish = function publish(args, user, connectionId) {
  check(args, {
    documentId: Match.DocumentId,
  });

  // We need a user reference.
  if (!user) {
    throw new Meteor.Error('unauthorized', "Unauthorized.");
  }

  const publishedAt = new Date();

  const changed = this.documents.update(this.restrictQuery({
    _id: args.documentId,
    publishedAt: null,
  }, this.PERMISSIONS.ADMIN, user), {
    $set: {
      publishedAt,
      publishedBy: user.getReference(),
      updatedAt: publishedAt,
      lastActivity: publishedAt,
      defaultPermissions: this.getPermissionsFromRole(this.ROLES.COMMENT),
      visibility: this.VISIBILITY_LEVELS.LISTED,
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
          _id: args.documentId,
        },
      },
    });
  }

  return changed;
};

Document._share = function share(args, user, connectionId) {
  check(args, {
    documentId: Match.DocumentId,
    visibility: Match.OrNull(Match.Enumeration(Match.NonEmptyString, Document.VISIBILITY_LEVELS)),
    defaultRole: Match.OrNull(Match.Enumeration(Match.NonEmptyString, _.omit(Document.ROLES, 'ADMIN'))),
    contributors: Match.OrNull([
      {
        userId: Match.DocumentId,
        role: Match.OrNull(Match.Enumeration(Match.NonEmptyString, Document.ROLES)),
      },
    ]),
  });

  const document = Document.documents.findOne(Document.restrictQuery({
    _id: args.documentId,
  }, Document.PERMISSIONS.ADMIN, user), {
    fields: Document.PERMISSIONS_FIELDS(),
  });

  if (!document) {
    throw new Meteor.Error('not-found', "Document cannot be found.");
  }

  // We need a user reference.
  assert(user);

  const timestamp = new Date();

  let userPermissions = null;
  if (args.contributors !== null) {
    // We start with current user's permissions.
    userPermissions = filterPermissionObjects(document.userPermissions, user._id);

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

  if (args.visibility !== null && document.visibility !== args.visibility) {
    updates.visibility = args.visibility;
    visibilityChanged = true;
  }

  // If default permissions are custom, then to keep them unchanged, "null" is passed.
  let defaultPermissions = null;
  if (args.defaultRole !== null) {
    defaultPermissions = Document.getPermissionsFromRole(args.defaultRole);
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
      _id: args.documentId,
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
          visibility: args.visibility,
          document: {
            _id: args.documentId,
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
};

Meteor.methods({
  'Document.create'(args) {
    if (Meteor.settings.public.apiControlled) {
      throw new Meteor.Error('forbidden', "Method disabled.");
    }

    const user = Meteor.user(_.extend(User.REFERENCE_FIELDS(), User.CHECK_PERMISSIONS_FIELDS()));

    return Document._create(args, user, (this.connection && this.connection.id) || null);
  },

  'Document.publish'(args) {
    if (Meteor.settings.public.apiControlled) {
      throw new Meteor.Error('forbidden', "Method disabled.");
    }

    const user = Meteor.user(_.extend(User.REFERENCE_FIELDS(), User.CHECK_PERMISSIONS_FIELDS()));

    return Document._publish(args, user, (this.connection && this.connection.id) || null);
  },

  'Document.share'(args) {
    if (Meteor.settings.public.apiControlled) {
      throw new Meteor.Error('forbidden', "Method disabled.");
    }

    const user = Meteor.user(_.extend(User.REFERENCE_FIELDS(), User.CHECK_PERMISSIONS_FIELDS()));

    return Document._share(args, user, (this.connection && this.connection.id) || null);
  },

  'Document.fork'(args) {
    check(args, {
      documentId: String,
    });

    const user = Meteor.user(User.REFERENCE_FIELDS());

    // TODO: Check fork permissions.

    const doc = Document.documents.findOne({
      _id: args.documentId,
    });

    const {contentKey} = doc;

    const createdAt = new Date();
    const forkContentKey = Content.Meta.collection._makeNewID();

    // Add forkContentKey to the existing contents.
    Content.documents.update(
      {
        contentKeys: contentKey,
      },
      {
        $addToSet: {
          contentKeys: forkContentKey,
        },
      }, {
        multi: true,
      },
    );

    const toCreate = {
      contentKey: forkContentKey,
      createdAt,
      updatedAt: createdAt,
      lastActivity: createdAt,
      author: user.getReference(),
      publishedBy: null,
      publishedAt: null,
      title: doc.title,
      version: doc.version,
      body: doc.body,
      forkedFrom: doc.getReference(),
      forkedAtVersion: doc.version,
      lastSync: doc.version,
      isMerged: false,
    };

    const documentId = insertNewDocument(user, (this.connection && this.connection.id), createdAt, forkContentKey, toCreate);

    return {documentId};
  },

  'Document.merge'(args) {
    check(args, {
      documentId: String,
    });

    // TODO: Check Merge permissions.

    const fork = Document.documents.findOne(
      {
        _id: args.documentId,
        isMerged: {$ne: true},
      },
      {
        fields: {
          _id: 1,
          title: 1,
          body: 1,
          version: 1,
          contentKey: 1,
          lastSync: 1,
          forkedFrom: 1,
        },
      },
    );

    // Get original document.
    const original = Document.documents.findOne({
      _id: fork.forkedFrom._id,
    }, {
      fields: {
        _id: 1,
        contentKey: 1,
      },
    });

    // Add original steps to forked.
    Content.documents.update({
      contentKeys: fork.contentKey,
      version: {
        $gt: fork.lastSync,
      },
    }, {
      $addToSet: {
        contentKeys: original.contentKey,
      },
    }, {
      multi: true,
    });

    const timestamp = new Date();

    // Update forked document
    Document.documents.update({
      _id: fork._id,
    }, {
      $set: {
        isMerged: true,
        lastSync: fork.version,
        updatedAt: timestamp,
        lastActivity: timestamp,
        title: fork.title,
      },
    });

    // Update original document
    Document.documents.update({
      _id: original._id,
    }, {
      $set: {
        version: fork.version,
        body: fork.body,
      },
    });
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
      fields: Document.PUBLISH_FIELDS(),
    });
  });
});
