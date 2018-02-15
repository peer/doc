import {check} from 'meteor/check';
import {Meteor} from 'meteor/meteor';

import {Comment} from '/lib/comment';

Meteor.publish('Comment.list', function commentList(args) {
  check(args, {});

  this.enableScope();

  return Comment.documents.find({}, {fields: Comment.PUBLISH_FIELDS()});
});
