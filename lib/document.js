import {Meteor} from 'meteor/meteor';
import {_} from 'meteor/underscore';

import {ValidatedMethod} from 'meteor/mdg:validated-method';

import {BaseDocument} from './base';
import {User} from './user';
import {method} from './utils';

export class Document extends BaseDocument {
  // createdAt: time of document creation
  // updatedAt: time of the last change
  // lastActivity: time of the last activity one the document
  // author:
  //   _id
  //   username
  //   avatar
  // publishedBy:
  //  _id
  //   username
  //   avatar
  // publishedAt: time when document was published
  // title: automatically generated title from the latest version of the document

  static REFERENCE_FIELDS() {
    return {
      _id: 1
    }
  }

  static PUBLISH_FIELDS() {
    return _.extend(super.PUBLISH_FIELDS(), {
      _id: 1,
      createdAt: 1,
      publishedBy: 1,
      publishedAt: 1,
      title: 1
    });
  }

  getReference() {
    return _.pick(this, _.keys(this.constructor.REFERENCE_FIELDS()));
  }

  isPublished() {
    return !!(this.publishedBy && this.publishedAt);
  }
}

Document.Meta({
  name: 'Document',
  fields(fields) {
    return _.extend(fields, {
      author: Document.ReferenceField(User, User.REFERENCE_FIELDS()),
      publishedBy: Document.ReferenceField(User, User.REFERENCE_FIELDS(), false)
    });
  }
});

Document.create = method(new ValidatedMethod({
  name: 'Document.create',

  validate(args) {
    check(args, {});
  },

  run({}) {
    const user = Meteor.user(User.REFERENCE_FIELDS());
    if (!user) {
      throw new Meteor.Error('unauthorized', "Unauthorized.");
    }

    if (!User.hasPermission(User.PERMISSIONS.DOCUMENT_CREATE)) {
      throw new Meteor.Error('unauthorized', "Unauthorized.");
    }

    const createdAt = new Date();

    const documentId = Document.documents.insert({
      createdAt: createdAt,
      updatedAt: createdAt,
      lastActivity: createdAt,
      author: user.getReference(),
      publishedBy: null,
      publishedAt: null,
      title: ''
    });

    return {
      _id: documentId
    }
  }
}));

if (Meteor.isServer) {
  Document.Meta.collection._ensureIndex({
    createdAt: 1
  });
}
