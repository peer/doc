import {check, Match} from 'meteor/check';
import {Meteor} from 'meteor/meteor';

import {Document} from '/lib/document';

Meteor.publish('Document.list', function (args) {
  check(args, {});

  this.enableScope();

  return Document.documents.find({}, {fields: Document.PUBLISH_FIELDS()});
});

Meteor.publish('Document.one', function (args) {
  check(args, {
    documentId: Match.DocumentId
  });

  return Document.documents.find({
    _id: args.documentId
  }, {fields: Document.PUBLISH_FIELDS()});
});
