import {check, Match} from 'meteor/check';
import {Meteor} from 'meteor/meteor';

import {Activity} from '/lib/documents/activity';
import {Document} from '/lib/documents/document';
import {Content} from '/lib/documents/content';
import {User} from '/lib/documents/user';

import {schema} from "../../lib/full-schema";

const create = (user, connectionId) => {
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
};

Meteor.methods({
  'Document.publish'(args) {
    check(args, {
      documentId: String,
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
      documentId: String,
      visibilityLevel: String,
      contributors: [{user: {_id: Match.DocumentId, username: String, avatar: String}, role: String}],
    });

    const user = Meteor.user(User.REFERENCE_FIELDS());

    const now = new Date();

    let contributors = [];

    let adminCount = 0;

    args.contributors.forEach((x) => {
      adminCount += x.role === Document.ROLES.ADMIN;

      if (args.visibilityLevel !== Document.VISIBILITY_LEVELS.PRIVATE && x.role === Document.ROLES.SEE) {
        throw new Meteor.Error('invalid-selection', `There can be no users with ${Document.ROLES.SEE} role when visibility is not ${Document.VISIBILITY_LEVELS.PRIVATE}`);
      }

      contributors = contributors.concat(Document.getUserPermissions(x.role, x.user, now, user.getReference()));
    });

    if (adminCount === 0) {
      throw new Meteor.Error('no-admin', `There must be at least one admin user for this document.`);
    }

    const changed = Document.documents.update(Document.restrictQuery({
      _id: args.documentId,
    }, [], user, {$and: [{userPermissions: {$elemMatch: {'user._id': user._id, permission: Document.PERMISSIONS.ADMIN}}}]}), {
      $set: {
        updatedAt: now,
        lastActivity: now,
        userPermissions: contributors,
        visibility: args.visibilityLevel,
      },
    });

    if (changed) {
      Activity.documents.insert({
        timestamp: now,
        connection: this.connection.id,
        byUser: user.getReference(),
        // We inform all followers of this document.
        // TODO: Implement once we have followers.
        forUsers: [],
        type: 'documentShared',
        level: Activity.LEVEL.GENERAL,
        data: {
          document: {
            _id: args.documentId,
          },
        },
      });
    }
    else {
      throw new Meteor.Error('not-found', `Document cannot be found.`);
    }
  },
  'Document.create'(args) {
    check(args, {});
    const user = Meteor.user(User.REFERENCE_FIELDS());

    // We need user reference.
    if (!user || !user.hasPermission(Document.PERMISSIONS.CREATE)) {
      throw new Meteor.Error('unauthorized', "Unauthorized.");
    }

    return create(user, (this.connection && this.connection.id) || null);
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
    }, Document.PERMISSIONS.SEE), {
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
      }, [], user, {$and: [{$or: [{visibility: {$ne: Document.VISIBILITY_LEVELS.PRIVATE}}, {userPermissions: {$elemMatch: {'user._id': user._id, permission: Document.PERMISSIONS.SEE}}}]}]}), {
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

Meteor.publish('Document.admin', function documentOne(args) {
  check(args, {
    documentId: Match.DocumentId,
  });

  const user = Meteor.user(User.REFERENCE_FIELDS());
  const adminFields = Document.PUBLISH_FIELDS();
  adminFields.userPermissions = 1;

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
