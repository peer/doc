// These utils are available only during testing.

import {Match} from 'meteor/check';
import {Meteor} from 'meteor/meteor';

import {Comment} from '/lib/documents/comment';
import {Content} from '/lib/documents/content';
import {Document} from '/lib/documents/document';
import {User} from '/lib/documents/user';
import {check} from '/server/check';

Meteor.methods({
  '_test.commentFind'(query) {
    check(query, Match.Any);
    return Comment.documents.find(query).fetch();
  },

  '_test.contentFind'(query) {
    check(query, Match.Any);
    return Content.documents.find(query).fetch();
  },

  '_test.documentFind'(query) {
    check(query, Match.Any);
    return Document.documents.find(query).fetch();
  },

  '_test.userFind'(query) {
    check(query, Match.Any);
    return User.documents.find(query).fetch();
  },
});
