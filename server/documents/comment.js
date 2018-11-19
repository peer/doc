import {Match} from 'meteor/check';
import {Meteor} from 'meteor/meteor';
import {_} from 'meteor/underscore';

import assert from 'assert';
import {Node} from 'prosemirror-model';

import {Activity} from '/lib/documents/activity';
import {Comment} from '/lib/documents/comment';
import {Content} from '/lib/documents/content';
import {Document} from '/lib/documents/document';
import {User} from '/lib/documents/user';
import {schema} from '/lib/simple-schema.js';
import {check} from '/server/check';

Comment._create = function create(args, user, connectionId) {
  check(args, {
    documentId: Match.DocumentId,
    highlightKey: Match.DocumentId,
    body: Object,
    replyTo: Match.Maybe(Match.DocumentId),
    contentKey: Match.DocumentId,
  });

  // Validate body.
  Node.fromJSON(schema, args.body).check();

  // We first check that the user has a class-level permission to create comments.
  if (!User.hasClassPermission(this.PERMISSIONS.CREATE, user)) {
    throw new Meteor.Error('unauthorized', "Unauthorized.");
  }

  // We need a user reference.
  assert(user);

  // Then we check that the user has permissions on comment's document.
  const document = Document.documents.findOne(Document.restrictQuery({
    _id: args.documentId,
  }, Document.PERMISSIONS.COMMENT_CREATE, user), {fields: Document.REFERENCE_FIELDS()});
  if (!document) {
    throw new Meteor.Error('not-found', `Document cannot be found.`);
  }

  const {version} = Content.getCurrentState(args.contentKey);

  let replyTo = null;
  if (args.replyTo) {
    replyTo = this.documents.findOne(this.restrictQuery({
      _id: args.replyTo,
    }, this.PERMISSIONS.VIEW, user), {fields: Document.REFERENCE_FIELDS()});
    if (!replyTo) {
      throw new Meteor.Error('not-found', `Comment cannot be found.`);
    }
  }

  const createdAt = new Date();

  const commentId = this.documents.insert({
    createdAt,
    author: user.getReference(),
    document: document.getReference(),
    body: args.body,
    versionFrom: version,
    versionTo: null,
    // TODO: Validate highlight key.
    highlightKey: args.highlightKey,
    replyTo: replyTo && replyTo.getReference(),
    deletedAt: null,
    deletedBy: null,
    status: this.STATUS.CREATED,
    userPermissions: [{
      user: user.getReference(),
      addedAt: createdAt,
      addedBy: user.getReference(),
      permission: this.PERMISSIONS.VIEW,
    }, {
      user: user.getReference(),
      addedAt: createdAt,
      addedBy: user.getReference(),
      permission: this.PERMISSIONS.DELETE,
    }],
  });

  Document.documents.update({
    _id: args.documentId,
    lastActivity: {
      $lt: createdAt,
    },
  }, {
    $set: {
      lastActivity: createdAt,
    },
  });

  Activity.documents.insert({
    timestamp: createdAt,
    connection: connectionId,
    byUser: user.getReference(),
    // We inform all followers of this document.
    // TODO: Implement once we have followers.
    forUsers: [],
    type: 'commentCreated',
    level: Activity.LEVEL.GENERAL,
    data: {
      document: document.getReference(),
      comment: {
        _id: commentId,
      },
    },
  });

  return {
    _id: commentId,
  };
};

// TODO: Should we add/modify/delete an Activity?
Comment._delete = function delete_(args, user) {
  check(args, {
    commentId: Match.DocumentId,
    version: Match.Integer,
  });

  // We need a user reference.
  if (!user) {
    throw new Meteor.Error('unauthorized', "Unauthorized.");
  }

  const deletedAt = new Date();

  // We do not do additional permission check on the document in this case.
  let deleted = this.documents.update(this.restrictQuery({
    _id: args.commentId,
  }, this.PERMISSIONS.DELETE, user), {
    $set: {
      deletedAt,
      deletedBy: user.getReference(),
      versionTo: args.version,
      status: this.STATUS.DELETED,
    },
  });

  if (deleted) {
    // If thread was deleted, then we have to delete also all replies to it.
    // We do not check for permissions here because user deleting the whole
    // thread does not necessary have delete permission for all replies directly.
    // TODO: Should we give permissions to those who can delete a whole thread also for deletion of all comments in a thread?
    //       This then means that those users could also delete individual comments in a thread.
    deleted += this.documents.update({
      'replyTo._id': args.commentId,
    }, {
      $set: {
        deletedAt,
        deletedBy: user.getReference(),
        versionTo: args.version,
        status: this.STATUS.DELETED,
      },
    }, {
      multi: true,
    });
  }

  return deleted;
};

Comment.filterOrphan = function filterOrphan(documentId, doc, version) {
  const highlightKeys = [];

  doc.descendants((node, pos) => {
    const mark = _.find(node.marks, (m) => {
      return m.type.name === 'highlight';
    });
    if (mark) {
      highlightKeys.push(mark.attrs['highlight-key']);
    }
  });

  // Set "versionTo" to "null" for all "CREATED" comments with highlights present in the
  // current editor state, in case of re-applying a previous step, e.g., with Ctrl+Z.
  this.documents.update({
    'document._id': documentId,
    highlightKey: {
      $in: highlightKeys,
    },
    status: this.STATUS.CREATED,
  }, {
    $set: {
      versionTo: null,
    },
  }, {
    multi: true,
  });

  this.documents.update({
    'document._id': documentId,
    highlightKey: {
      $nin: highlightKeys,
    },
    status: this.STATUS.CREATED,
    versionTo: null,
  }, {
    $set: {
      versionTo: version,
    },
  }, {
    multi: true,
  });
};

Meteor.methods({
  'Comment.create'(args) {
    const user = Meteor.user(_.extend(User.REFERENCE_FIELDS(), User.CHECK_PERMISSIONS_FIELDS()));

    return Comment._create(args, user, (this.connection && this.connection.id) || null);
  },

  'Comment.delete'(args) {
    const user = Meteor.user(_.extend(User.REFERENCE_FIELDS(), User.CHECK_PERMISSIONS_FIELDS()));

    return Comment._delete(args, user);
  },
});

Meteor.publish('Comment.list', function commentList(args) {
  check(args, {
    documentId: Match.DocumentId,
  });

  this.enableScope();

  this.autorun((computation) => {
    const user = Meteor.user(User.CHECK_PERMISSIONS_FIELDS());

    // We first check that the user has permissions on comment's document.
    if (!Document.existsAndCanUser({_id: args.documentId}, Document.PERMISSIONS.COMMENT_VIEW, user)) {
      return [];
    }

    // And then we publish only those comments for which the user has permission.
    return Comment.documents.find(Comment.restrictQuery({
      'document._id': args.documentId,
      status: Comment.STATUS.CREATED,
    }, Comment.PERMISSIONS.VIEW, user), {
      fields: Comment.PUBLISH_FIELDS(),
    });
  });
});
