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
      contributors: [{user: {_id: Match.DocumentId, username: String, avatar: String}, selectedPermission: String}],
    });

    const user = Meteor.user(User.REFERENCE_FIELDS());

    const now = new Date();

    const contributors = [];

    args.contributors.forEach((x) => {
      const permissions = Document.getPermissions(x.selectedPermission);
      permissions.forEach((p) => {
        contributors.push(Object.assign({}, x, {
          addedAt: now,
          addedBy: user.getReference(),
          permission: p,
        }));
      });
    });

    const changed = Document.documents.update(Document.restrictQuery({
      _id: args.documentId,
    }, Document.PERMISSIONS.ADMIN, user), {
      $set: {
        updatedAt: now,
        lastActivity: now,
        userPermissions: contributors,
        visibilityLevel: args.visibilityLevel,
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
