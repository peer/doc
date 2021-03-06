import {_} from 'meteor/underscore';

import {User} from './user';
import {Document} from './document';
import {BasePermissionedDocument} from '../base';
import {callAsync} from '../utils';

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
  // deletedAt: time of comment deletion
  // deletedBy: user who deleted a comment
  //   _id
  //   username
  //   avatar
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
    });
  }

  // All comment permissions also require that user has corresponding permissions on comment's document.
  static PERMISSIONS = {
    // We use upper case even for strings because we are using upper case for permissions and lower case for roles.
    VIEW: 'COMMENT_VIEW',
    CREATE: 'COMMENT_CREATE',
    DELETE: 'COMMENT_DELETE',
  };

  static STATUS = {
    CREATED: 'created',
    DELETED: 'deleted',
  };

  // TODO: Do not allow access to private comments once we will have them.
  static _restrictQueryForAnonymousUser(query, permissions) {
    if (_.contains(permissions, this.PERMISSIONS.VIEW)) {
      return query;
    }
    else {
      return super._restrictQueryForAnonymousUser(query, permissions);
    }
  }

  static create(...args) {
    return callAsync('Comment.create', args);
  }

  static delete(...args) {
    return callAsync('Comment.delete', args);
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
