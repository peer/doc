import {check, Match} from 'meteor/check';
import {Meteor} from 'meteor/meteor';
import {_} from 'meteor/underscore';

import assert from 'assert';
import {Step} from 'prosemirror-transform';

import {Document} from '/lib/documents/document';
import {Content} from '/lib/documents/content';
import {Comment} from '/lib/documents/comment';
import {User} from '/lib/documents/user';
import {schema} from '/lib/full-schema';
import {extractTitle, stepsAreOnlyHighlights} from '/lib/utils';

// TODO: Make documents expire after a while.
const documents = new Map();

Content.removeDocumentState = (args) => {
  documents.delete(args.contentKey);
};

function updateCurrentState(contentKey, doc, version) {
  if (documents.has(contentKey)) {
    if (version > documents.get(contentKey).version) {
      documents.set(contentKey, {doc, version});
    }
  }
  else {
    documents.set(contentKey, {doc, version});
  }
}

Content.getCurrentState = (contentKey) => {
  let doc;
  let version;
  if (documents.has(contentKey)) {
    ({doc, version} = documents.get(contentKey));
  }
  else {
    doc = schema.topNodeType.createAndFill();
    version = 0;
  }

  Content.documents.find({
    contentKeys: contentKey,
    version: {
      $gt: version,
    },
  }, {
    sort: {
      version: 1,
    },
    fields: {
      step: 1,
      version: 1,
    },
  }).forEach((content) => {
    const result = Step.fromJSON(schema, content.step).apply(doc);

    if (!result.doc) {
      // eslint-disable-next-line no-console
      console.error("Error applying a step.", result.failed);
      throw new Meteor.Error('invalid-request', "Invalid step.");
    }

    doc = result.doc;
    version = content.version;

    // We update current state only when we do have steps stored in the database and
    // we do not store the initial empty document and version 0 to make it slightly
    // harder to make a DoS attack my requesting state for many content keys.
    updateCurrentState(contentKey, doc, version);
  });

  if (documents.has(contentKey)) {
    const {version: currentVersion, doc: currentDoc} = documents.get(contentKey);
    // If there is a newer version available, we return that one. We do not retry updating our "doc"
    // again with potential further steps available because this could turn into a fight between two
    // concurrent calls to "getCurrentState" each trying to handle an intense stream of added steps
    // and making each other retry again and again. Instead, we prefer to return a potentially older
    // version (which means that further steps are available in the database) and leave it to the
    // caller to not be able to insert more steps, returning to the client to retry sending its steps.
    // In this way we leave to clients to handle an intense stream of steps first.
    if (currentVersion > version) {
      return {version: currentVersion, doc: currentDoc};
    }
    // If it is not newer, it should match the version we just retrieved (before "forEach") or
    // just updated (in "forEach").
    assert(currentVersion === version);
  }

  return {doc, version};
};

// Server-side only method, so we are not using ValidatedMethod.
Meteor.methods({
  'Content.addSteps'(args) {
    check(args, {
      contentKey: Match.DocumentId,
      currentVersion: Match.NonNegativeInteger,
      steps: [Object],
      clientId: Match.DocumentId,
    });

    // There should be steps.
    check(args.steps, Match.Where((x) => {
      return x.length > 0;
    }));

    const steps = args.steps.map((step) => {
      return Step.fromJSON(schema, step);
    });

    const onlyHighlights = stepsAreOnlyHighlights(steps);

    const user = Meteor.user(_.extend(User.REFERENCE_FIELDS(), User.CHECK_PERMISSIONS_FIELDS()));

    // We do not use "CREATE" permission because from the point of the steps we
    // are always updating the (potentially) empty already created document.
    const allowedPermissions = [Document.PERMISSIONS.UPDATE];
    if (onlyHighlights) {
      allowedPermissions.push(Document.PERMISSIONS.COMMENT_CREATE);
    }

    const document = Document.documents.findOne(Document.restrictQuery({
      contentKey: args.contentKey,
    }, allowedPermissions, user), {
      fields: {
        _id: 1,
        publishedAt: 1,
      },
    });

    if (!document) {
      throw new Meteor.Error('not-found', "Document cannot be found.");
    }

    // We need a user reference.
    assert(user);

    // "Document.restrictQuery" makes sure that we are not updating
    // (with non-highlights steps) a published document.
    assert(!document.isPublished() || onlyHighlights);

    let {doc, version} = Content.getCurrentState(args.contentKey);

    if (args.currentVersion !== version) {
      // If "currentVersion" is newer than "version" there might be a bug on the client,
      // or we got an older state with not all steps from the database applied. In both cases
      // the client should try again with probably correct version. If it is older, then client
      // should try again as well, after updating its state with new steps.
      return 0;
    }

    const timestamp = new Date();

    for (const step of steps) {
      const result = step.apply(doc);

      if (!result.doc) {
        // eslint-disable-next-line no-console
        console.error("Error applying a step.", result.failed);
        throw new Meteor.Error('invalid-request', "Invalid step.");
      }

      doc = result.doc;
      version += 1;

      // Validate that the step produced a valid document.
      doc.check();

      // eslint-disable-next-line no-unused-vars
      const {numberAffected, insertedId} = Content.documents.upsert({
        version,
        contentKeys: args.contentKey,
      }, {
        $setOnInsert: {
          contentKeys: [args.contentKey],
          createdAt: timestamp,
          author: user.getReference(),
          clientId: args.clientId,
          step: step.toJSON(),
        },
      });

      if (!insertedId) {
        // Document was just updated, not inserted, so this means that there was already
        // a step with "version". This means we have to return to the client and the
        // client should try again.
        break;
      }

      updateCurrentState(args.contentKey, doc, version);
    }

    Document.documents.update({
      contentKey: args.contentKey,
      version: {
        // We update only if we have a newer version then already in the database.
        $lt: version,
      },
    }, {
      $set: {
        version,
        body: doc.toJSON(),
        updatedAt: timestamp,
        lastActivity: timestamp,
        title: extractTitle(doc),
      },
    });

    // TODO: This could be done in the background?
    Comment.filterOrphan(document._id, doc, version);

    Meteor.setTimeout((x) => {
      Document.rebaseStep({documentId: document._id});
    }, 100);
    return version - args.currentVersion;
  },
});

Meteor.publish('Content.list', function contentList(args) {
  check(args, {
    contentKey: Match.DocumentId,
  });

  this.enableScope();

  this.autorun((computation) => {
    // We check that the user has permissions on content's document.
    if (!Document.existsAndCanUser({contentKey: args.contentKey}, Document.PERMISSIONS.VIEW)) {
      return [];
    }

    return Content.documents.find(
      {
        contentKeys: args.contentKey,
      },
      {
        fields: Content.PUBLISH_FIELDS(),
      },
    );
  });
});

// For testing.
export {Content};
