import {HTTP} from 'meteor/http';
import {Meteor} from 'meteor/meteor';
import {_} from 'meteor/underscore';

import moment from 'moment';

import {Document} from '/lib/documents/document';

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
  const timestamp = new Date().valueOf();
  if (!sessionKeyTimestamp || sessionKeyTimestamp.valueOf() + SESSION_KEY_TTL < timestamp) {
    const response = HTTP.call('POST', `${Meteor.settings.appCivistIntegration.endpoint}/api/user/login`, {
      data: _.pick(Meteor.settings.appCivistIntegration, 'email', 'password'),
    });

    sessionKey = response.data.sessionKey;
    sessionKeyTimestamp = timestamp;
  }

  return sessionKey;
}

function update(id, fields) {
  // We process the change only if the first character of the document
  // ID matches one of characters in "prefix". In this way we distribute
  // processing across multiple nodes.
  if (!prefix.includes(id[0])) {
    return;
  }

  const params = {};

  if (Object.prototype.hasOwnProperty.call(fields, 'title')) {
    params.title = fields.title;
  }
  if (Object.prototype.hasOwnProperty.call(fields, 'lastActivity')) {
    params.lastUpdate = moment(fields.lastActivity).format('YYYY-MM-DD HH:mm:ss');
  }

  HTTP.call('PUT', `${Meteor.settings.appCivistIntegration.endpoint}/api/contribution/${id}`, {
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
      added: update,
      changed: update,
    });
  });
}
