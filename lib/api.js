// Here we make sure we are exposing only Meteor methods we want.
// Many packages add things we might prefer not exposing.

import {Meteor} from 'meteor/meteor';

Meteor.startup(function startup() {
  const methodHandlers = Meteor.isClient ? Meteor.connection._methodHandlers : Meteor.server.method_handlers;

  const BLACKLISTED_METHODS = [
    // We do not want login services to be configured from the client.
    'configureLoginService',
    // This method is used for backwards compatibility with Meteor 0.7.2,
    // It was replaced with "getNewToken" and "removeOtherTokens" methods.
    'logoutOtherClients',
    // We have a custom method for creating users.
    'createUser',
    // Accounts methods we are currently not using.
    'changePassword',
    'forgotPassword',
    'resetPassword',
    'verifyEmail',
  ];

  for (const methodName of Object.keys(methodHandlers)) {
    // We remove all direct mutation methods on collections.
    // One should always use only Meteor methods to modify collections.
    if (methodName.startsWith('/')) {
      delete methodHandlers[methodName];
    }

    // Delete blacklisted methods.
    if (BLACKLISTED_METHODS.includes(methodName)) {
      delete methodHandlers[methodName];
    }
  }
});
