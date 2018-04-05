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

// TODO: Use path information from router instead of hard-coding the path here.
WebApp.connectHandlers.use('/document', (req, res, next) => {
  if (req.method === 'POST') {
    try {
      if (!req.query || !req.query.user) {
        throw new Error("'user' query string parameter is missing.");
      }

      const {_id: documentId} = createDocumentOfUserFromToken(req.query.user);
      const result = JSON.stringify({
        documentId,
        status: 'success',
        // TODO: Use router to construct the path.
        path: `/document/${documentId}`,
      });

      res.writeHead(200, {'Content-Type': 'application/json'});
      res.end(result);
    }
    catch (error) {
      // eslint-disable-next-line no-console
      console.error("Error handling /document API request.", error);
      res.writeHead(400, {'Content-Type': 'application/json'});
      res.end(JSON.stringify({
        status: 'error',
      }));
    }
  }
  else {
    next();
  }
});
