import {HTTP} from 'meteor/http';
import {Meteor} from 'meteor/meteor';
import {_} from 'meteor/underscore';

import moment from 'moment';

import {Comment} from '/lib/documents/comment';
import {Document} from '/lib/documents/document';
import {User} from '/lib/documents/user';

let sessionKey = null;
let sessionKeyTimestamp = null;

const SESSION_KEY_TTL = 30 * 24 * 60 * 60; // 30 days, seconds
const UNMISTAKABLE_CHARS = '23456789ABCDEFGHJKLMNPQRSTWXYZabcdefghijkmnopqrstuvwxyz';

let prefix = UNMISTAKABLE_CHARS.split('');

if (Document.instances > 1) {
  const range = UNMISTAKABLE_CHARS.length / Document.instances;
  prefix = prefix.slice(Math.round(Document.instance * range), Math.round((Document.instance + 1) * range));
}

function getSessionKey() {
  const timestamp = Date.now();
  if (!sessionKeyTimestamp || sessionKeyTimestamp.valueOf() + SESSION_KEY_TTL < timestamp) {
    const response = HTTP.call('POST', `${Meteor.settings.appCivistIntegration.endpoint}/api/user/login`, {
      data: _.pick(Meteor.settings.appCivistIntegration, 'email', 'password'),
    });

    sessionKey = response.data.sessionKey;
    sessionKeyTimestamp = timestamp;
  }

  return sessionKey;
}

function documentUpdated(id, fields) {
  // We process the change only if the first character of the document
  // ID matches one of characters in "prefix". In this way we distribute
  // processing across multiple nodes.
  if (!prefix.includes(id[0])) {
    return;
  }

  const params = {};

  if (_.has(fields, 'title')) {
    params.title = fields.title;
  }
  if (_.has(fields, 'lastActivity')) {
    params.lastActivity = moment(fields.lastActivity).toISOString();
  }

  if (_.isEmpty(params)) {
    return;
  }

  HTTP.call('PUT', `${Meteor.settings.appCivistIntegration.endpoint}/api/contribution/${id}`, {
    params,
    data: {},
    headers: {
      SESSION_KEY: getSessionKey(),
    },
  });
}

function commentInserted(id, fields) {
  // We process the change only if the first character of the document
  // ID matches one of characters in "prefix". In this way we distribute
  // processing across multiple nodes.
  if (!prefix.includes(id[0])) {
    return;
  }

  // A required field is missing.
  if (!(fields.author && fields.author._id && fields.document && fields.document._id)) {
    return;
  }

  const author = User.documents.findOne({_id: fields.author._id, 'services.usertoken': {$exists: true}}, {fields: {'services.usertoken': 1}});
  const appCivistUserId = author && author.services && author.services.usertoken && author.services.usertoken.id;

  // We notify only for AppCivist users.
  if (!appCivistUserId) {
    return;
  }

  const params = {
    eventType: 'NEW_CONTRIBUTION_COMMENT',
    userId: appCivistUserId,
  };

  HTTP.call('POST', `${Meteor.settings.appCivistIntegration.endpoint}/api/contribution/${fields.document._id}/signal`, {
    params,
    data: {},
    headers: {
      SESSION_KEY: getSessionKey(),
    },
  });
}

if (Meteor.settings.appCivistIntegration && Meteor.settings.appCivistIntegration.endpoint && Meteor.settings.appCivistIntegration.email && Meteor.settings.appCivistIntegration.password) {
  Meteor.startup(() => {
    if (Document.instanceDisabled) {
      return;
    }

    Document.documents.find({}, {
      fields: {
        title: 1,
        lastActivity: 1,
      },
    }).observeChanges({
      added: documentUpdated,
      changed: documentUpdated,
    });
  });

  Meteor.startup(() => {
    if (Comment.instanceDisabled) {
      return;
    }

    let initializing = true;
    Comment.documents.find({}, {
      fields: {
        author: 1,
        document: 1,
      },
    }).observeChanges({
      added(id, fields) {
        if (!initializing) {
          commentInserted(id, fields);
        }
      },
    });
    initializing = false;
  });
}
