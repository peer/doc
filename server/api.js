import {Meteor} from 'meteor/meteor';
import {WebApp} from 'meteor/webapp';

import {Document} from '/lib/documents/document';
import {createUserAndSignIn, decrypt} from '/server/auth-token';
import {AppCivistNonce} from '/lib/documents/appcivist-nonce';

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
