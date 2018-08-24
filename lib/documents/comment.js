import {Meteor} from 'meteor/meteor';
import {_} from 'meteor/underscore';

import {BasePermissionedDocument} from '../base';
import {User} from './user';
import {Document} from './document';

export class Comment extends BasePermissionedDocument {
  // _id: ID of the document
  // createdAt: time of document creation
  // author: user who created a comment
  //   _id
  //   username
  //   avatar
  // document: document for which the comment was created
  //   _id
  // body: content of the comment as ProseMirror document
  // versionFrom: version of the content the comment was created at
  // versionTo: version of the content the comment was removed at
  // highlightKey: ID of the content highlight with which this comment is associated with
  // replyTo:
  //   _id: reply to which other comment this is
  // deletedAt: time of document deletion
  // status: determines the status of the comment
  // userPermissions: a list of
  //   user:
  //     _id
  //     username
  //     avatar
  //   addedAt: timestamp
  //   addedBy:
  //     _id
  //     username
  //     avatar
  //   permission: a permission string

  static PUBLISH_FIELDS() {
    return _.extend(super.PUBLISH_FIELDS(), {
      _id: 1,
      author: 1,
      document: 1,
      body: 1,
      versionFrom: 1,
      versionTo: 1,
      highlightKey: 1,
      createdAt: 1,
      replyTo: 1,
      status: 1,
      deletedAt: 1,
    });
  }
}

Comment.Meta({
  name: 'Comment',
  fields(fields) {
    return _.extend(fields, {
      author: Comment.ReferenceField(User, User.REFERENCE_FIELDS()),
      document: Comment.ReferenceField(Document, Document.REFERENCE_FIELDS()),
      replyTo: Comment.ReferenceField(Comment, Comment.REFERENCE_FIELDS(), false),
    });
  },
});

// All comment permissions also require that user has corresponding permissions on comment's document.
Comment.PERMISSIONS = {
  // We use upper case even for strings because we are using upper case for permissions and lower case for roles.
  VIEW: 'COMMENT_VIEW',
  CREATE: 'COMMENT_CREATE',
  DELETE: 'COMMENT_DELETE',
};

Comment.STATUS = {
  CREATED: 'created',
  DELETED: 'deleted',
};

Comment.create = function create(...args) {
  args.unshift('Comment.create');
  return Meteor.call(...args);
};

Comment.delete = function remove(...args) {
  args.unshift('Comment.delete');
  return Meteor.call(...args);
};
