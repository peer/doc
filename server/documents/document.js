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
    if (!user) {
      throw new Meteor.Error('unauthorized', "Unauthorized.");
    }

    Document.documents.update({
      _id: args.documentId,
    }, {
      $set: {
        publishedBy: user.getReference(),
        publishedAt: new Date(),
      },
    });
  },
});

Meteor.publish('Document.list', function documentList(args) {
  check(args, {});

  this.enableScope();

  return Document.documents.find({}, {fields: Document.PUBLISH_FIELDS()});
});

Meteor.publish('Document.one', function documentOne(args) {
  check(args, {
    documentId: Match.DocumentId,
  });

  return Document.documents.find({
    _id: args.documentId,
  }, {fields: Document.PUBLISH_FIELDS()});
});
