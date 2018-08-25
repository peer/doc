import {Meteor} from 'meteor/meteor';
import {WebApp} from 'meteor/webapp';

import assert from 'assert';

import {Document} from '/lib/documents/document';
import {createUserFromToken} from '/server/auth-token';
import {User} from "../lib/documents/user";

// TODO: Use path information from router instead of hard-coding the path here.
WebApp.connectHandlers.use('/document', (req, res, next) => {
  if (req.method === 'POST') {
    try {
      if (!req.query || !req.query.user) {
        throw new Error("'user' query string parameter is missing.");
      }

      const user = createUserFromToken(req.query.user);

      // We check that the user has a class-level permission to create documents.
      if (!User.hasClassPermission(Document.PERMISSIONS.CREATE, user)) {
        throw new Meteor.Error('unauthorized', "Unauthorized.");
      }

      // We need a user reference.
      assert(user);

      const document = Document._create(user, null);

      const result = JSON.stringify({
        documentId: document._id,
        status: 'success',
        // TODO: Use router to construct the path.
        path: `/document/${document._id}`,
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
