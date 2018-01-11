// Here we make sure we are exposing only publish endpoints we want.
// Many packages add things we might prefer not exposing.

// There are also universal publish endpoints, but those are harder to
// identify. See: https://github.com/meteor/meteor-feature-requests/issues/213

import {Meteor} from 'meteor/meteor';

Meteor.startup(function startup() {
  const publishHandlers = Meteor.server.publish_handlers;

  const BLACKLISTED_PUBLISH_ENDPOINTS = [];

  for (const publishName of publishHandlers.keys()) {
    // Delete blacklisted publish endpoints.
    if (BLACKLISTED_PUBLISH_ENDPOINTS.includes(publishName)) {
      delete publishHandlers[publishName];
    }
  }
});
