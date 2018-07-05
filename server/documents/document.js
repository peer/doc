import {check, Match} from 'meteor/check';
import {Meteor} from 'meteor/meteor';

import {Activity} from '/lib/documents/activity';
import {Document} from '/lib/documents/document';
import {User} from '/lib/documents/user';


const checkDocumentPermissions = (permissionList, documentId) => {
  const user = Meteor.user(User.REFERENCE_FIELDS());
  const document = Document.documents.findOne({_id: documentId});
  const permissions = {};

  permissionList.forEach((x) => {
    const found = document.userPermissions.find((y) => {
      return user && y.user._id === user._id && y.permission === x;
    });
    permissions[x] = !!found;
  });

  return permissions;
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

    const permissions = checkDocumentPermissions([Document.PERMISSIONS.ADMIN], args.documentId);

    if (!permissions[Document.PERMISSIONS.ADMIN]) {
      throw new Meteor.Error('not-allowed', `User not allowed to share this document.`);
    }

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
    }, Document.PERMISSIONS.ADMIN, user), {
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
  },
  'Document.checkDocumentPermissions'(args) {
    check(args, {
      permissions: [String],
      documentId: String,
    });
    return checkDocumentPermissions(args.permissions, args.documentId);
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

  const user = Meteor.user(User.REFERENCE_FIELDS());

  this.autorun((computation) => {
    if (user) {
      return Document.documents.find(Document.restrictQuery({
        _id: args.documentId,
      }, [], user, {$and: [{$or: [{visibility: {$ne: Document.VISIBILITY_LEVELS.PRIVATE}}, {userPermissions: {$elemMatch: {'user._id': user._id, permission: Document.PERMISSIONS.SEE}}}]}]}), {
        fields: Document.PUBLISH_FIELDS(),
      });
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
