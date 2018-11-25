import {Match} from 'meteor/check';
import {Meteor} from 'meteor/meteor';
import {WebApp} from 'meteor/webapp';
import {_} from 'meteor/underscore';

import bodyParser from 'body-parser';
import {JSDOM} from 'jsdom';
import parseurl from 'parseurl';
import {DOMSerializer, Node} from 'prosemirror-model';

import {Document} from '/lib/documents/document';
import {schema} from '/lib/full-schema';
import {createOrGetUser, createUserFromToken} from '/server/auth-token';
import {check} from '/server/check';

// TODO: Use path information from router instead of hard-coding the path here.
WebApp.connectHandlers.use('/document', (req, res, next) => {
  const match = parseurl(req).pathname.match(/^\/$/);

  if (!match) {
    next();
    return;
  }

  if (req.method === 'POST') {
    try {
      if (!req.query || !req.query.user) {
        throw new Error("'user' query string parameter is missing.");
      }

      const user = createUserFromToken(req.query.user);

      const document = Document._create({}, user, null);

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

// TODO: Use path information from router instead of hard-coding the path here.
WebApp.connectHandlers.use('/document/export', (req, res, next) => {
  const match = parseurl(req).pathname.match(/^\/([^/]+)$/);

  if (!match) {
    next();
    return;
  }

  if (req.method === 'POST') {
    try {
      if (!req.query || !req.query.user) {
        throw new Error("'user' query string parameter is missing.");
      }

      const documentId = match[1];

      const user = createUserFromToken(req.query.user);

      check(documentId, Match.DocumentId);

      const document = Document.documents.findOne(Document.restrictQuery({_id: documentId}, Document.PERMISSIONS.VIEW, user));

      if (!document) {
        throw new Meteor.Error('not-found', "Document cannot be found.");
      }

      const body = Node.fromJSON(schema, document.body);

      const dom = new JSDOM('<!DOCTYPE html><body></body>');

      const nodes = DOMSerializer.nodesFromSchema(schema);
      const marks = DOMSerializer.marksFromSchema(schema);

      // We do not want to export highlights. And deleted marks should not be present.
      delete marks.highlight;
      delete marks.deleted;

      const serializer = new DOMSerializer(nodes, marks);
      const fragment = serializer.serializeFragment(body.content, {document: dom.window.document});

      dom.window.document.body.appendChild(fragment);

      const result = JSON.stringify({
        status: 'success',
        html: dom.serialize(),
      });

      res.writeHead(200, {'Content-Type': 'application/json'});
      res.end(result);
    }
    catch (error) {
      // eslint-disable-next-line no-console
      console.error("Error handling /document/export API request.", error);
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

// TODO: Use path information from router instead of hard-coding the path here.
WebApp.connectHandlers.use('/document/publish', (req, res, next) => {
  const match = parseurl(req).pathname.match(/^\/([^/]+)$/);

  if (!match) {
    next();
    return;
  }

  if (req.method === 'POST') {
    try {
      if (!req.query || !req.query.user) {
        throw new Error("'user' query string parameter is missing.");
      }

      const documentId = match[1];

      const user = createUserFromToken(req.query.user);

      const changed = Document._publish({documentId}, user, null);

      if (changed) {
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({
          status: 'success',
        }));
      }
      else {
        res.writeHead(400, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({
          status: 'error',
        }));
      }
    }
    catch (error) {
      // eslint-disable-next-line no-console
      console.error("Error handling /document/publish API request.", error);
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

WebApp.connectHandlers.use('/document/share', bodyParser.json({strict: true}));

// TODO: Use path information from router instead of hard-coding the path here.
WebApp.connectHandlers.use('/document/share', (req, res, next) => {
  const match = parseurl(req).pathname.match(/^\/([^/]+)$/);

  if (!match) {
    next();
    return;
  }

  if (req.method === 'POST') {
    try {
      if (!req.query || !req.query.user) {
        throw new Error("'user' query string parameter is missing.");
      }

      if (!req.body) {
        throw new Error("Request body is missing.");
      }

      const documentId = match[1];

      const user = createUserFromToken(req.query.user);

      let visibility = null;
      if (_.has(req.body, 'visibility')) {
        if (req.body.visibility === true) {
          visibility = Document.VISIBILITY_LEVELS.PUBLIC;
        }
        else if (req.body.visibility === false) {
          visibility = Document.VISIBILITY_LEVELS.PRIVATE;
        }
        else {
          throw new Error("Invalid visibility value.");
        }
      }

      let contributors = null;
      // The order of roles is important because if the user is listed multiple
      // times, we want the higher order to take effect. In "Document._share"
      // only the first entry in the list of contributors is used.
      for (const role of ['ADMIN', 'EDIT']) {
        if (req.body.token_users && req.body.token_users[role.toLowerCase()]) {
          if (contributors === null) {
            contributors = [];
          }
          for (const userDescriptor of req.body.token_users[role.toLowerCase()]) {
            contributors.push({
              userId: createOrGetUser(userDescriptor)._id,
              role: Document.ROLES[role],
            });
          }
        }
      }

      // TODO: Should we only the first time set default permissions to "COMMENT", but later leave it?
      const changed = Document._share({documentId, visibility, contributors, defaultRole: Document.ROLES.COMMENT}, user, null);

      if (changed) {
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({
          status: 'success',
        }));
      }
      else {
        res.writeHead(400, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({
          status: 'error',
        }));
      }
    }
    catch (error) {
      // eslint-disable-next-line no-console
      console.error("Error handling /document/share API request.", error);
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

// TODO: Use path information from router instead of hard-coding the path here.
WebApp.connectHandlers.use('/document/fork', (req, res, next) => {
  const match = parseurl(req).pathname.match(/^\/([^/]+)$/);

  if (!match) {
    next();
    return;
  }

  if (req.method === 'POST') {
    try {
      if (!req.query || !req.query.user) {
        throw new Error("'user' query string parameter is missing.");
      }

      const documentId = match[1];

      const user = createUserFromToken(req.query.user);

      const document = Document._fork({documentId}, user, null);

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
      console.error("Error handling /document/fork API request.", error);
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

// TODO: Use path information from router instead of hard-coding the path here.
WebApp.connectHandlers.use('/document/merge', (req, res, next) => {
  const match = parseurl(req).pathname.match(/^\/([^/]+)$/);

  if (!match) {
    next();
    return;
  }

  if (req.method === 'POST') {
    try {
      if (!req.query || !req.query.user) {
        throw new Error("'user' query string parameter is missing.");
      }

      const documentId = match[1];

      const user = createUserFromToken(req.query.user);

      // Throws an exception if merge is not possible.
      Document._acceptMerge({documentId}, user, null);

      res.writeHead(200, {'Content-Type': 'application/json'});
      res.end(JSON.stringify({
        status: 'success',
      }));
    }
    catch (error) {
      // eslint-disable-next-line no-console
      console.error("Error handling /document/merge API request.", error);
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
