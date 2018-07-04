import {check, Match} from 'meteor/check';
import {Meteor} from 'meteor/meteor';

import {Activity} from '/lib/documents/activity';
import {Document} from '/lib/documents/document';
import {User} from '/lib/documents/user';

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

    args.contributors.forEach((x) => {
      contributors = contributors.concat(Document.getUserPermissions(x.role, x.user, now, user.getReference()));
    });

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

    const user = Meteor.user(User.REFERENCE_FIELDS());

    const document = Document.documents.findOne({_id: args.documentId});

    const permissions = {};

    args.permissions.forEach((x) => {
      const found = document.userPermissions.find((y) => {
        return y.user._id === user._id && y.permission === x;
      });
      permissions[x] = !!found;
    });

    return permissions;
  },
});

Meteor.publish('Document.list', function documentList(args) {
  check(args, {});

  this.enableScope();

  this.autorun((computation) => {
    // TODO: Show unpublished documents to users with UPDATE permission.
    // TODO: Show public drafts to users.
    return Document.documents.find(Document.restrictQuery({
      publishedAt: {$ne: null},
    }, Document.PERMISSIONS.SEE), {
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
    }, Document.PERMISSIONS.SEE), {
      fields: Document.PUBLISH_FIELDS(),
    });
  });
});

// For testing.
export {Document};
