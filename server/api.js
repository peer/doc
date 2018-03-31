import {Meteor} from 'meteor/meteor';
import {WebApp} from 'meteor/webapp';

import {Document} from '/lib/documents/document';
import {createUserAndSignIn, decrypt} from '/server/auth-token';
import {Nonce} from '/lib/documents/nonce';

// Obtaining shared secret from "settings.json".
const {tokenSharedSecret} = Meteor.settings;

function createDocumentOfUserFromToken(userToken) {
  const decryptedToken = decrypt(userToken, tokenSharedSecret);
  // store nonce on DB
  Nonce.addNonce({nonce: decryptedToken.nonce});
  const user = createUserAndSignIn({userToken: decryptedToken});
  return Document._create(user, false);
}

WebApp.connectHandlers.use('/document', (req, response, next) => {
  if (req.method === 'POST' && req.query && req.query.user) {
    const {_id: documentId} = createDocumentOfUserFromToken(req.query.user);
    response.writeHead(200, {'Content-Type': 'application/json'});
    response.end(JSON.stringify({path: `/document/${documentId}`}));
  }
  else {
    next();
  }
});
