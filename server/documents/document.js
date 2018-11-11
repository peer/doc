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

// "query" must match only one document.
Document.lock = function lock(query, appendLock, modifyLock, onFailure, onSuccess) {
  if (!appendLock && !modifyLock) {
    throw new Error("At least one of \"appendLock\" and \"modifyLock\" has to be set.");
  }

  // We first make a query to check any permissions so that locks are not made
  // without permissions.
  const document = this.documents.findOne(query, {_id: 1});

  if (!document) {
    throw new Meteor.Error('not-found', "Document cannot be found.");
  }

  const lockTimestamp = new Date();

  const lockQuery = {};
  const lockUpdate = {};
  const lockRelease = {};

  if (appendLock) {
    lockQuery.hasContentAppendLock = null;
    lockUpdate.hasContentAppendLock = lockTimestamp;
    lockRelease.hasContentAppendLock = null;
  }
  if (modifyLock) {
    lockQuery.hasContentModifyLock = null;
    lockUpdate.hasContentModifyLock = lockTimestamp;
    lockRelease.hasContentModifyLock = null;
  }

  const lockAcquired = this.documents.update({
    $and: [
      {
        _id: document._id,
      },
      query,
      lockQuery,
    ],
  }, {
    $set: lockUpdate,
  });

  // TODO: Retry again few times before aborting.
  if (!lockAcquired) {
    return onFailure(document._id);
  }

  try {
    return onSuccess(document._id);
  }
  finally {
    if (lockAcquired) {
      this.documents.update({
        _id: document._id,
      }, {
        $set: lockRelease,
      });
    }
  }
};

function insertNewDocument(user, connectionId, createdAt, contentKey, documentFields) {
  const userPermissions = getPermissionObjects(
    Document.getPermissionsFromRole(Document.ROLES.ADMIN),
    user.getReference(),
    createdAt,
    user.getReference(),
  );

  const document = {
    contentKey,
    createdAt,
    updatedAt: createdAt,
    lastActivity: createdAt,
    author: user.getReference(),
    publishedBy: null,
    publishedAt: null,
    title: '',
    body: schema.topNodeType.createAndFill().toJSON(),
    version: 0,
    forkedFrom: null,
    forkedAtVersion: null,
    rebasedAtVersion: null,
    hasContentAppendLock: null,
    hasContentModifyLock: null,
    mergeAcceptedBy: null,
    mergeAcceptedAt: null,
    userPermissions,
    visibility: Document.VISIBILITY_LEVELS.PRIVATE,
    defaultPermissions: Document.getPermissionsFromRole(Document.ROLES.VIEW),
  };

  if (documentFields) {
    Object.assign(document, documentFields);
  }

  return Document.documents.insert(document);
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
    // TODO: Do we? Because document is initially private only to the person who created it?
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

  // "restrictQuery" makes sure that the document is not already published or merged.
  const changed = this.documents.update(this.restrictQuery({
    _id: args.documentId,
    // We should not change the published status while content is being modified.
    hasContentAppendLock: null,
    hasContentModifyLock: null,
  }, this.PERMISSIONS.PUBLISH, user), {
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
    visibility: Match.OrNull(Match.Enumeration(Match.NonEmptyString, this.VISIBILITY_LEVELS)),
    defaultRole: Match.OrNull(Match.Enumeration(Match.NonEmptyString, _.omit(this.ROLES, 'ADMIN'))),
    contributors: Match.OrNull([
      {
        userId: Match.DocumentId,
        role: Match.OrNull(Match.Enumeration(Match.NonEmptyString, this.ROLES)),
      },
    ]),
  });

  const document = this.documents.findOne(this.restrictQuery({
    _id: args.documentId,
  }, this.PERMISSIONS.ADMIN, user), {
    fields: this.PERMISSIONS_FIELDS(),
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
          this.getPermissionsFromRole(contributor.role),
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
    defaultPermissions = this.getPermissionsFromRole(args.defaultRole);
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
    changed = this.documents.update({
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

Document._fork = function create(args, user, connectionId) {
  check(args, {
    documentId: Match.DocumentId,
  });

  // We check that the user has a class-level permission to create documents.
  if (!User.hasClassPermission(this.PERMISSIONS.CREATE, user)) {
    throw new Meteor.Error('unauthorized', "Unauthorized.");
  }

  // We need a user reference.
  assert(user);

  const parentDocument = this.documents.findOne(this.restrictQuery({
    _id: args.documentId,
    // Parent document should be published.
    publishedAt: {$ne: null},
    publishedBy: {$ne: null},
  }, this.PERMISSIONS.VIEW, user));

  if (!parentDocument) {
    throw new Meteor.Error('not-found', "Document cannot be found.");
  }

  const createdAt = new Date();
  const forkContentKey = Random.id();

  // Add "forkContentKey" to the existing content documents.
  Content.documents.update({
    contentKeys: parentDocument.contentKey,
    // We want to use only content documents at the point we fetched the parent document.
    // It could happen that in meantime new content documents would be added.
    version: {$lte: parentDocument.version},
  }, {
    $addToSet: {
      contentKeys: forkContentKey,
    },
  }, {
    multi: true,
  });

  const documentFields = {
    title: parentDocument.title,
    version: parentDocument.version,
    body: parentDocument.body,
    forkedFrom: parentDocument.getReference(),
    forkedAtVersion: parentDocument.version,
    rebasedAtVersion: parentDocument.version,
  };

  const documentId = insertNewDocument(user, connectionId, createdAt, forkContentKey, documentFields);

  // There could be new content added after the point we fetched the parent document,
  // so we trigger rebase from the parent document to be sure.
  Content.scheduleRebase(parentDocument._id);

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
    // TODO: Do we? Because document is initially private only to the person who forked it?
    forUsers: groupUsers,
    type: 'documentForked',
    level: Activity.LEVEL.GENERAL,
    data: {
      document: {
        _id: documentId,
      },
      parentDocument: {
        _id: parentDocument._id,
      },
    },
  });

  return {
    _id: documentId,
    contentKey: forkContentKey,
  };
};

Document._acceptMerge = function create(args, user, connectionId) {
  check(args, {
    documentId: Match.DocumentId,
  });

  // We need a user reference.
  if (!user) {
    throw new Meteor.Error('unauthorized', "Unauthorized.");
  }

  const forkId = args.documentId;

  const forkQuery = this.restrictQuery({
    _id: forkId,
    'forkedFrom._id': {$ne: null},
    // Fork should not be published or merged.
    publishedAt: null,
    publishedBy: null,
    mergeAcceptedAt: null,
    mergeAcceptedBy: null,
  // TODO: Use "SUGGEST_MERGE" instead of "VIEW" here.
  }, this.PERMISSIONS.VIEW, user);

  // This query serves two purposes. The first is to get "parentDocumentId"
  // so that we can first lock the parent document and then the fork.
  // The second is to check that the user has permissions on the fork
  // so that locks are not made without permissions. (Check for permissions
  // on the parent document is made inside the first "lock" call.)
  let fork = this.findOne(forkQuery, {forkedFrom: 1});

  if (!fork) {
    throw new Meteor.Error('not-found', "Document cannot be found.");
  }

  const parentDocumentId = fork.forkedFrom._id;

  // "restrictQuery" makes sure that the document is published.
  const parentDocumentQuery = this.restrictQuery({
    _id: parentDocumentId,
  }, this.PERMISSIONS.ACCEPT_MERGE, user);

  let mergeAcceptedAt = null;

  // We acquire both locks on the parent document. This means that while
  // the locks are acquired, nothing else can be merged into the parent,
  // it cannot be rebased, nor new steps can be added to its content.
  // We use both locks because even if the parent document is published,
  // new content steps can be added for comment annotations. But we need
  // to have a fixed version of the parent document to assure the fork
  // has been rebased to it and move content steps correctly to the parent.
  this.lock(parentDocumentQuery, true, true, (lockedParentDocumentId) => {
    throw new Meteor.Error('internal-error', "Lock could not be acquired.");
  }, (lockedParentDocumentId) => {
    assert.strictEqual(lockedParentDocumentId, parentDocumentId);

    // We acquire both locks because at this stage we do not want any content changes
    // anymore to the fork because it is getting frozen. But we have to lock it first,
    // so that we have time to update content documents.
    // It is important that we lock in this order (parent document first, then fork)
    // because "rebaseSteps" is doing it in the same order as well. Otherwise it
    // could happen that we end up in a deadlock.
    this.lock(forkQuery, true, true, (lockedForkId) => {
      throw new Meteor.Error('internal-error', "Lock could not be acquired.");
    }, (lockedForkId) => {
      assert.strictEqual(lockedForkId, forkId);

      // We fetch the document here to make sure we have the most recent (and locked) state.
      const parentDocument = this.documents.findOne({
        $and: [
          {
            _id: parentDocumentId,
          },
          parentDocumentQuery,
        ],
      });

      if (!parentDocument) {
        throw new Meteor.Error('not-found', "Document cannot be found.");
      }

      assert(parentDocument.hasContentAppendLock);
      assert(parentDocument.hasContentModifyLock);

      // We (re)fetch the document here to make sure we have the most recent (and locked) state.
      fork = this.documents.findOne({
        $and: [
          {
            _id: forkId,
          },
          forkQuery,
        ],
      });

      if (!fork) {
        throw new Meteor.Error('not-found', "Document cannot be found.");
      }

      assert(fork.hasContentAppendLock);
      assert(fork.hasContentModifyLock);

      if (parentDocument.version !== fork.rebasedAtVersion) {
        throw new Meteor.Error('internal-error', "Fork is not rebased.");
      }

      // Add fork steps to parent document.
      Content.documents.update({
        contentKeys: fork.contentKey,
        version: {
          $gt: fork.rebasedAtVersion,
        },
      }, {
        $addToSet: {
          contentKeys: parentDocument.contentKey,
        },
      }, {
        multi: true,
      });

      mergeAcceptedAt = new Date();

      // Update parent document.
      this.documents.update({
        _id: parentDocumentId,
      }, {
        $set: {
          version: fork.version,
          body: fork.body,
          title: fork.title,
          updatedAt: mergeAcceptedAt,
          lastActivity: mergeAcceptedAt,
        },
      });

      // Update fork.
      const changed = this.documents.update({
        _id: forkId,
      }, {
        $set: {
          mergeAcceptedAt,
          mergeAcceptedBy: user.getReference(),
          rebasedAtVersion: fork.version,
          updatedAt: mergeAcceptedAt,
          lastActivity: mergeAcceptedAt,
        },
      });

      if (!changed) {
        throw new Meteor.Error('internal-error', "Merge failed.");
      }
    });
  });

  assert(mergeAcceptedAt);

  // There is new content in the parent document, so we have to rebase it to all its
  // children documents (forks) which might exist besides the document we just merged.
  Content.scheduleRebase(parentDocumentId);

  // TODO: Improve once we really have groups.
  const groupUsers = User.documents.find({}, {
    fields: User.REFERENCE_FIELDS(),
    transform: null,
  }).fetch();

  Activity.documents.insert({
    timestamp: mergeAcceptedAt,
    connection: connectionId,
    byUser: user.getReference(),
    // We inform all users in this group.
    // TODO: Do we? Should we inform just users who are following the parent document and/or fork?
    forUsers: groupUsers,
    type: 'documentMergeAccepted',
    level: Activity.LEVEL.GENERAL,
    data: {
      document: {
        _id: forkId,
      },
      parentDocument: {
        _id: parentDocumentId,
      },
    },
  });
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
    if (Meteor.settings.public.apiControlled) {
      throw new Meteor.Error('forbidden', "Method disabled.");
    }

    const user = Meteor.user(_.extend(User.REFERENCE_FIELDS(), User.CHECK_PERMISSIONS_FIELDS()));

    return Document._fork(args, user, (this.connection && this.connection.id) || null);
  },

  'Document.acceptMerge'(args) {
    if (Meteor.settings.public.apiControlled) {
      throw new Meteor.Error('forbidden', "Method disabled.");
    }

    const user = Meteor.user(_.extend(User.REFERENCE_FIELDS(), User.CHECK_PERMISSIONS_FIELDS()));

    return Document._acceptMerge(args, user, (this.connection && this.connection.id) || null);
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
