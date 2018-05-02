import {check, Match} from 'meteor/check';
import {Meteor} from 'meteor/meteor';

import {Document} from '/lib/documents/document';
import {User} from '/lib/documents/user';

Meteor.methods({
  'Document.publish'(args) {
    check(args, {
      documentId: String,
    });

    const user = Meteor.user(User.REFERENCE_FIELDS());

    const timestamp = new Date();

    return Document.documents.update(Document.restrictQuery({
      _id: args.documentId,
    }, Document.PERMISSIONS.ADMIN, user), {
      $set: {
        updatedAt: timestamp,
        lastActivity: timestamp,
        publishedBy: user.getReference(),
        publishedAt: timestamp,
      },
    });
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

export {Document};
