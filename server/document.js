import {check} from 'meteor/check';
import {Meteor} from 'meteor/meteor';

import {Document} from '/lib/document';

Meteor.publish('Document.list', function (args) {
  check(args, {});

  this.enableScope();

  return Document.documents.find({}, {fields: Document.PUBLISH_FIELDS()});
});
