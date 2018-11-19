// These utils are available only during testing.

import {Match} from 'meteor/check';
import {Meteor} from 'meteor/meteor';

import {Comment} from '/lib/documents/comment';
import {Content} from '/lib/documents/content';
import {Document} from '/lib/documents/document';
import {User} from '/lib/documents/user';
import {check} from '/server/check';

Meteor.methods({
  '_test.commentFind'(query, options) {
    check(query, Match.Any);
    check(options, Match.Any);
    return Comment.documents.find(query, options).fetch();
  },

  '_test.contentFind'(query, options) {
    check(query, Match.Any);
    check(options, Match.Any);
    return Content.documents.find(query, options).fetch();
  },

  '_test.documentFind'(query, options) {
    check(query, Match.Any);
    check(options, Match.Any);
    return Document.documents.find(query, options).fetch();
  },

  '_test.userFind'(query, options) {
    check(query, Match.Any);
    check(options, Match.Any);
    return User.documents.find(query, options).fetch();
  },

  '_test.commentUpdate'(query, update) {
    check(query, Match.Any);
    check(update, Match.Any);
    return Comment.documents.update(query, update, {multi: true});
  },

  '_test.contentUpdate'(query, update) {
    check(query, Match.Any);
    check(update, Match.Any);
    return Content.documents.update(query, update, {multi: true});
  },

  '_test.documentUpdate'(query, update) {
    check(query, Match.Any);
    check(update, Match.Any);
    return Document.documents.update(query, update, {multi: true});
  },

  '_test.userUpdate'(query, update) {
    check(query, Match.Any);
    check(update, Match.Any);
    return User.documents.update(query, update, {multi: true});
  },
});
