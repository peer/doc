import {check, Match} from 'meteor/check';
import {Meteor} from 'meteor/meteor';

import {Step, Transform} from 'prosemirror-transform';

import {Random} from 'meteor/random';
import {_} from 'meteor/underscore';

import assert from 'assert';

import {Activity} from '/lib/documents/activity';
import {Content} from '/lib/documents/content';
import {Document} from '/lib/documents/document';
import {User} from '/lib/documents/user';

import {extractTitle} from '/lib/utils';

import {schema} from '../../lib/full-schema';

function insertNewDocument(user, connectionId, createdAt, contentKey, doc) {
  const userPermissions = Document.getPermissionObjects(
    Document.getRolePermissions(Document.ROLES.ADMIN),
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
    defaultPermissions: Document.getRolePermissions(Document.ROLES.VIEW),
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

Document._create = (user, connectionId) => {
  const createdAt = new Date();
  const contentKeys = [Random.id()];

  Content.documents.insert({
    createdAt,
    contentKeys,
    author: user.getReference(),
    clientId: null,
    version: 0,
    step: null,
  });

  const documentId = insertNewDocument(user, connectionId, createdAt, contentKeys[0]);
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
      defaultPermissions: Document.getRolePermissions(Document.ROLES.COMMENT),
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
    defaultPermissions = Document.getRolePermissions(defaultRole);
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
  'Document.undoChanges'(args) {
    check(args, {
      documentId: String,
    });

    const fork = Document.documents.findOne(
      {
        _id: args.documentId,
      },
      {
        fields: {
          contentKey: 1,
          forkedAtVersion: 1,
          forkedFrom: 1,
          _id: 1,
        },
      },
    );

    Content.documents.remove({
      version: {
        $gt: fork.forkedAtVersion,
      },
      contentKeys: fork.contentKey,
    });

    let doc = schema.topNodeType.createAndFill();

    Content.documents.find({
      contentKeys: fork.contentKey,
      version: {
        $gt: 0,
      },
    }, {
      sort: {
        version: 1,
      },
      fields: {
        step: 1,
        version: 1,
      },
    }).fetch().forEach((content) => {
      const result = Step.fromJSON(schema, content.step).apply(doc);

      if (!result.doc) {
        // eslint-disable-next-line no-console
        console.error("Error applying a step.", result.failed);
        throw new Meteor.Error('invalid-request', "Invalid step.");
      }
      doc = result.doc;
    });

    const timestamp = new Date();

    // Update document version.
    Document.documents.update({
      _id: args.documentId,
    }, {
      $set: {
        version: fork.forkedAtVersion,
        body: doc.toJSON(),
        updatedAt: timestamp,
        lastActivity: timestamp,
        title: extractTitle(doc),
      },
    });

    Content.removeDocumentState({contentKey: fork.contentKey});
  },
  'Document.rebaseStep'(args) {
    check(args, {
      documentId: String,
    });

    const {documentId} = args;

    // TODO: Check Rebase permissions.

    // Get forked document.
    const fork = Document.documents.findOne(
      {
        'forkedFrom._id': documentId,
        isMerged: {$ne: true},
      },
      {
        fields: {
          contentKey: 1,
          forkedAtVersion: 1,
          lastSync: 1,
          forkedFrom: 1,
          _id: 1,
        },
      },
    );

    if (!fork) {
      return;
    }

    // Get forked document steps.
    const forkSteps = Content.documents.find(
      {
        version: {
          $gt: fork.lastSync,
        },
        contentKeys: fork.contentKey,
      },
      {
        sort: {
          version: 1,
        },
      },
    ).fetch()
    .map((x) => {
      return Object.assign({}, x, {
        step: Step.fromJSON(schema, x.step),
      });
    });

    // Get original document.
    const original = Document.documents.findOne({
      _id: fork.forkedFrom._id,
    });

    // Get original document steps that were applied after fork.
    const originalSteps = Content.documents.find(
      {
        version: {
          $gt: fork.lastSync,
        },
        contentKeys: original.contentKey,
      },
      {
        sort: {
          version: 1,
        },
      },
    ).fetch()
    .map((x) => {
      return Step.fromJSON(schema, x.step);
    });

    // Initialize doc and transform.
    let doc = schema.topNodeType.createAndFill();
    let transform;
    let version = 0;

    // Apply all the forked document steps to doc.
    Content.documents.find({
      contentKeys: fork.contentKey,
      version: {
        $gt: version,
      },
    }, {
      sort: {
        version: 1,
      },
      fields: {
        step: 1,
        version: 1,
      },
    }).fetch().forEach((content) => {
      if (content.version > fork.lastSync) {
        if (!transform) {
          transform = new Transform(doc);
        }
        transform.step(Step.fromJSON(schema, content.step));
      }
      else {
        version = content.version;
      }

      const result = Step.fromJSON(schema, content.step).apply(doc);

      if (!result.doc) {
        // eslint-disable-next-line no-console
        console.error("Error applying a step.", result.failed);
        throw new Meteor.Error('invalid-request', "Invalid step.");
      }
      doc = result.doc;
    });

    const shouldRebase = transform !== undefined && originalSteps.length > 0;

    if (shouldRebase) {
      // Revert steps that were applied on the forked document after fork.
      for (let i = transform.steps.length - 1; i >= 0; i -= 1) {
        const result = transform.steps[i].invert(transform.docs[i]).apply(doc);
        transform.step(transform.steps[i].invert(transform.docs[i]));
        if (!result.doc) {
          // eslint-disable-next-line no-console
          console.error("Error applying a step.", result.failed);
          throw new Meteor.Error('invalid-request', "Invalid step.");
        }
        doc = result.doc;
      }
    }
    else {
      transform = new Transform(doc);
    }

    // Apply all the original document steps.
    for (let i = 0; i < originalSteps.length; i += 1) {
      const result = originalSteps[i].apply(doc);
      transform.step(originalSteps[i]);
      if (!result.doc) {
        // eslint-disable-next-line no-console
        console.error("Error applying a step.", result.failed);
        throw new Meteor.Error('invalid-request', "Invalid step.");
      }
      doc = result.doc;
    }

    if (shouldRebase) {
      // Remap forked document steps and apply.
      for (let i = 0, mapFrom = forkSteps.length * 2; i < forkSteps.length; i += 1) {
        const mapped = forkSteps[i].step.map(transform.mapping.slice(mapFrom));
        mapFrom -= 1;
        if (mapped && !transform.maybeStep(mapped).failed) {
          const result = mapped.apply(doc);
          transform.mapping.setMirror(mapFrom, transform.steps.length - 1);

          if (!result.doc) {
            // eslint-disable-next-line no-console
            console.error("Error applying a step.", result.failed);
            throw new Meteor.Error('invalid-request', "Invalid step.");
          }
          doc = result.doc;
        }
      }
    }

    const timestamp = new Date();

    // Remove forked document steps.
    Content.documents.remove({
      contentKeys: fork.contentKey,
      version: {
        $gt: fork.lastSync,
      },
    });

    // Add original steps to forked.
    const updated = Content.documents.update({
      contentKeys: original.contentKey,
      version: {
        $gt: fork.lastSync,
      },
    }, {
      $addToSet: {
        contentKeys: fork.contentKey,
      },
    }, {
      multi: true,
    });

    version = fork.lastSync + updated;
    let index = 0;

    // Save merge steps.
    transform.steps.forEach((x, i) => {
      if (i >= ((forkSteps.length * 2) + (originalSteps.length))) {
        version += 1;
        Content.documents.upsert({
          version,
          contentKeys: fork.contentKey,
        }, {
          $setOnInsert: {
            contentKeys: [fork.contentKey],
            createdAt: forkSteps[index].createdAt,
            author: forkSteps[index].author,
            clientId: forkSteps[index].clientId,
            step: x.toJSON(),
          },
        });
        index += 1;
      }
    });

    if (fork.lastSync < original.version) {
      // Update document version
      Document.documents.update({
        _id: fork._id,
      }, {
        $set: {
          version,
          body: doc.toJSON(),
          updatedAt: timestamp,
          lastActivity: timestamp,
          title: extractTitle(doc),
          lastSync: original.version,
        },
      });
    }
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

// TODO: Add middleware and restrict only for the current user what is published for "userPermissions".
Meteor.publish('Document.list', function documentList(args) {
  check(args, {});

  this.enableScope();

  this.autorun((computation) => {
    return Document.documents.find(Document.restrictQuery({}, Document.PERMISSIONS.VIEW), {
      fields: Document.PUBLISH_FIELDS(),
    });
  });
});

// TODO: Add middleware and restrict only for the current user what is published for "userPermissions".
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
