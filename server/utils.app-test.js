// These utils are available only during testing.

import {Match} from 'meteor/check';
import {Meteor} from 'meteor/meteor';
import {_} from 'meteor/underscore';

import {Comment} from '/lib/documents/comment';
import {Content} from '/lib/documents/content';
import {Document} from '/lib/documents/document';
import {User} from '/lib/documents/user';
import {check} from '/server/check';

// We use "Npm.require" because otherwise Meteor and eslint
// complain that this module might not be found.
// eslint-disable-next-line no-undef
const Future = Npm.require('fibers/future');

const WAIT_FOR_DATABASE_TIMEOUT = 1500; // ms

export function waitForDatabase() {
  const future = new Future();

  let timeout = null;
  function newTimeout() {
    if (timeout) {
      Meteor.clearTimeout(timeout);
    }
    timeout = Meteor.setTimeout(function timeoutExpired() {
      timeout = null;
      if (!future.isResolved()) {
        future.return();
      }
    }, WAIT_FOR_DATABASE_TIMEOUT);
  }

  newTimeout();

  const handles = [];
  for (const document of Document.list) {
    handles.push(document.documents.find({}).observeChanges({
      added(id, fields) {
        newTimeout();
      },
      changed(id, fields) {
        newTimeout();
      },
      removed(id) {
        newTimeout();
      },
    }));
  }

  future.wait();

  for (const handle of handles) {
    handle.stop();
  }
}

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

  '_test.waitForDatabase'() {
    waitForDatabase();
  },

  '_test.configureSettings'(path, value) {
    check(path, String);
    check(value, Match.Any);
    const splitPath = path.split('.');
    let settings = Meteor.settings;
    for (let i = 0; i < splitPath.length - 1; i += 1) {
      let name = splitPath[i];
      if (_.isArray(settings)) {
        name = parseInt(name, 10);
      }
      if (!_.isObject(settings[name])) {
        settings[name] = {};
        settings = settings[name];
      }
      else {
        settings = settings[name];
      }
    }
    settings[splitPath[splitPath.length - 1]] = value;
  },
});
