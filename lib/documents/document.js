import {check} from 'meteor/check';
import {Meteor} from 'meteor/meteor';
import {_} from 'meteor/underscore';

import {ValidatedMethod} from 'meteor/mdg:validated-method';

import {BaseDocument} from '../base';
import {method} from '../utils';
import {Content} from './content';
import {User} from './user';

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
  // contentKey: ID used to identify editor's content

  static PUBLISH_FIELDS() {
    return _.extend(super.PUBLISH_FIELDS(), {
      _id: 1,
      createdAt: 1,
      publishedAt: 1,
      title: 1,
      contentKey: 1,
    });
  }

  isPublished() {
    return !!this.publishedAt;
  }
}

Document.Meta({
  name: 'Document',
  fields(fields) {
    return _.extend(fields, {
      author: Document.ReferenceField(User, User.REFERENCE_FIELDS()),
      publishedBy: Document.ReferenceField(User, User.REFERENCE_FIELDS(), false),
    });
  },
});

Document.PERMISSIONS = {
  // We use upper case even for strings because we are using upper case for permissions and lower case for roles.
  SEE: 'DOCUMENT_SEE',
  CREATE: 'DOCUMENT_CREATE',
  CREATE_API: 'DOCUMENT_CREATE_API',
  ADMIN: 'DOCUMENT_ADMIN',
  ADMIN_API: 'DOCUMENT_ADMIN_API',
  UPDATE: 'DOCUMENT_UPDATE',
  COMMENT_SEE: 'DOCUMENT_COMMENT_SEE',
  COMMENT_CREATE: 'DOCUMENT_COMMENT_CREATE',
};

function documentCreation(user, fromMeteorMethod) {
  let content = null;
  if (fromMeteorMethod) {
    content = Content.create({});
  }
  else {
    // We are not using use Content.create because it required an logged in user
    // Maybe we can factor this logic out in a Content._create method.
    const createdAt = new Date();
    const contentKey = Content.Meta.collection._makeNewID();

    const contentId = Content.documents.insert({
      createdAt,
      contentKey,
      author: user.getReference(),
      clientId: null,
      version: 0,
      step: null,
    });

    content = {
      createdAt,
      contentKey,
      _id: contentId,
    };
  }

  const documentId = Document.documents.insert({
    createdAt: content.createdAt,
    updatedAt: content.createdAt,
    lastActivity: content.createdAt,
    author: user.getReference(),
    publishedBy: null,
    publishedAt: null,
    title: '',
    contentKey: content.contentKey,
  });

  return {
    _id: documentId,
  };
}

Document.create = method(new ValidatedMethod({
  name: 'Document.create',

  validate(args) {
    check(args, {});
  },

  // eslint-disable-next-line no-empty-pattern
  run({}) {
    const user = Meteor.user(User.REFERENCE_FIELDS());
    if (!user) {
      throw new Meteor.Error('unauthorized', "Unauthorized.");
    }

    if (!User.hasPermission(Document.PERMISSIONS.CREATE)) {
      throw new Meteor.Error('unauthorized', "Unauthorized.");
    }
    return documentCreation(user, true);
  },
}));


Document._create = documentCreation;

Document.publish = function publish(...args) {
  args.unshift('Document.publish');
  return Meteor.call(...args);
};

if (Meteor.isServer) {
  Document.Meta.collection._ensureIndex({
    createdAt: 1,
  });
}
