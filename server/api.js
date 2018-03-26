// Here we make sure we are exposing only publish endpoints we want.
// Many packages add things we might prefer not exposing.

// There are also universal publish endpoints, but those are harder to
// identify. See: https://github.com/meteor/meteor-feature-requests/issues/213
import {Meteor} from 'meteor/meteor';
import {WebApp} from 'meteor/webapp';

import {Document} from '/lib/documents/document';
import {createUserAndSignIn} from '/server/documents/user';
import {decrypt} from '/server/embed';
import {AppCivistNonce} from '/lib/documents/appcivist-nonce';

Meteor.startup(function startup() {
  const publishHandlers = Meteor.server.publish_handlers;

  const BLACKLISTED_PUBLISH_ENDPOINTS = [];

  for (const publishName of Object.keys(publishHandlers)) {
    // Delete blacklisted publish endpoints.
    if (BLACKLISTED_PUBLISH_ENDPOINTS.includes(publishName)) {
      delete publishHandlers[publishName];
    }
  }
});

// Obtaining common keyHex between AppCivist and PeerDoc from settings.json
const {keyHex} = Meteor.settings;

function createDocumentOfUserFromToken(userToken) {
  const decryptedToken = decrypt(userToken, keyHex);
  // store nonce on DB
  AppCivistNonce.addNonce({nonce: decryptedToken.nonce});
  const user = createUserAndSignIn({userToken: decryptedToken});
  return Document._create(user, false);
}

WebApp.connectHandlers.use('/document', (req, response, next) => {
  // Handle POST request to be sent from AppCivist or other external service.
  if (req.method === 'POST' && req.query && req.query.user) {
    const {_id: documentId} = createDocumentOfUserFromToken(req.query.user);
    response.writeHead(200, {'Content-Type': 'application/json'});
    response.end(JSON.stringify({path: `/document/${documentId}`}));
  }
  else {
    next();
  }
});
