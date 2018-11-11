import {Match} from 'meteor/check';
import {Meteor} from 'meteor/meteor';
import {_} from 'meteor/underscore';

import assert from 'assert';
import {Step, Transform} from 'prosemirror-transform';

import {Document} from '/lib/documents/document';
import {Content} from '/lib/documents/content';
import {Comment} from '/lib/documents/comment';
import {User} from '/lib/documents/user';
import {schema} from '/lib/full-schema';
import {extractTitle, stepsAreOnlyHighlights} from '/lib/utils';
import {check} from '/server/check';

// TODO: Make documents expire after a while.
const documents = new Map();

function updateCurrentState(contentKey, rebasedCount, doc, version) {
  const key = `${contentKey}/${rebasedCount}`;

  if (documents.has(key)) {
    if (version > documents.get(key).version) {
      documents.set(key, {doc, version});
    }
  }
  else {
    documents.set(key, {doc, version});
  }
}

function rebaseSteps(documentId) {
  // TODO: Check Rebase permissions.

  // Get forked document.
  const fork = Document.documents.findOne(
    {
      'forkedFrom._id': documentId,
      mergeAcceptedAt: null,
    },
    {
      fields: {
        hasContentModifyLock: 1,
        contentKey: 1,
        forkedAtVersion: 1,
        rebasedAtVersion: 1,
        forkedFrom: 1,
        _id: 1,
      },
    },
  );

  if (!fork) {
    return;
  }

  // Get original document.
  const original = Document.documents.findOne({
    _id: fork.forkedFrom._id,
  });

  if (!fork.hasContentModifyLock && fork.rebasedAtVersion < original.version) {
    Document.documents.update({
      _id: fork._id,
    }, {
      $set: {
        hasContentModifyLock: new Date(),
      },
    });

    try {
      // Get forked document steps.
      const forkSteps = Content.documents.find(
        {
          version: {
            $gt: fork.rebasedAtVersion,
          },
          contentKeys: fork.contentKey,
        },
        {
          sort: {
            version: 1,
          },
        },
      ).fetch()
      .map((x) => {
        return Object.assign({}, x, {
          step: Step.fromJSON(schema, x.step),
        });
      });

      // Get original document steps that were applied after fork.
      const originalSteps = Content.documents.find(
        {
          version: {
            $gt: fork.rebasedAtVersion,
          },
          contentKeys: original.contentKey,
        },
        {
          sort: {
            version: 1,
          },
        },
      ).fetch()
      .map((x) => {
        return Step.fromJSON(schema, x.step);
      });

      // Initialize doc and transform.
      let doc = schema.topNodeType.createAndFill();
      let transform;
      let version = 0;

      // Apply all the forked document steps to doc.
      Content.documents.find({
        contentKeys: fork.contentKey,
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
      }).fetch().forEach((content) => {
        if (content.version > fork.rebasedAtVersion) {
          if (!transform) {
            transform = new Transform(doc);
          }
          transform.step(Step.fromJSON(schema, content.step));
        }
        else {
          version = content.version;
        }

        const result = Step.fromJSON(schema, content.step).apply(doc);

        if (!result.doc) {
          // eslint-disable-next-line no-console
          console.error("Error applying a step.", result.failed);
          throw new Meteor.Error('invalid-request', "Invalid step.");
        }
        doc = result.doc;
      });

      const shouldRebase = transform !== undefined && originalSteps.length > 0;

      if (shouldRebase) {
        // Revert steps that were applied on the forked document after fork.
        for (let i = transform.steps.length - 1; i >= 0; i -= 1) {
          const result = transform.steps[i].invert(transform.docs[i]).apply(doc);
          transform.step(transform.steps[i].invert(transform.docs[i]));
          if (!result.doc) {
            // eslint-disable-next-line no-console
            console.error("Error applying a step.", result.failed);
            throw new Meteor.Error('invalid-request', "Invalid step.");
          }
          doc = result.doc;
        }
      }
      else {
        transform = new Transform(doc);
      }

      // Apply all the original document steps.
      for (let i = 0; i < originalSteps.length; i += 1) {
        const result = originalSteps[i].apply(doc);
        transform.step(originalSteps[i]);
        if (!result.doc) {
          // eslint-disable-next-line no-console
          console.error("Error applying a step.", result.failed);
          throw new Meteor.Error('invalid-request', "Invalid step.");
        }
        doc = result.doc;
      }

      if (shouldRebase) {
        // Remap forked document steps and apply.
        for (let i = 0, mapFrom = forkSteps.length * 2; i < forkSteps.length; i += 1) {
          const mapped = forkSteps[i].step.map(transform.mapping.slice(mapFrom));
          mapFrom -= 1;
          if (mapped && !transform.maybeStep(mapped).failed) {
            const result = mapped.apply(doc);
            transform.mapping.setMirror(mapFrom, transform.steps.length - 1);

            if (!result.doc) {
              // eslint-disable-next-line no-console
              console.error("Error applying a step.", result.failed);
              throw new Meteor.Error('invalid-request', "Invalid step.");
            }
            doc = result.doc;
          }
        }
      }

      const timestamp = new Date();

      // Remove forked document steps.
      Content.documents.remove({
        contentKeys: fork.contentKey,
        version: {
          $gt: fork.rebasedAtVersion,
        },
      });

      // Add original steps to forked.
      const updated = Content.documents.update({
        contentKeys: original.contentKey,
        version: {
          $gt: fork.rebasedAtVersion,
          $lte: original.version,
        },
      }, {
        $addToSet: {
          contentKeys: fork.contentKey,
        },
      }, {
        multi: true,
      });

      version = fork.rebasedAtVersion + updated;
      let index = 0;

      // Save merge steps.
      transform.steps.forEach((x, i) => {
        if (i >= ((forkSteps.length * 2) + (originalSteps.length))) {
          version += 1;
          Content.documents.upsert({
            version,
            contentKeys: fork.contentKey,
          }, {
            $setOnInsert: {
              contentKeys: [fork.contentKey],
              createdAt: forkSteps[index].createdAt,
              author: forkSteps[index].author,
              clientId: forkSteps[index].clientId,
              step: x.toJSON(),
            },
          });
          index += 1;
        }
      });

      // Update document version
      Document.documents.update({
        _id: fork._id,
      }, {
        $set: {
          version,
          body: doc.toJSON(),
          updatedAt: timestamp,
          lastActivity: timestamp,
          title: extractTitle(doc),
          rebasedAtVersion: original.version,
          hasContentModifyLock: null,
        },
      });
      updateCurrentState(fork.contentKey, fork.rebasedAtVersion, doc, version);
    }
    catch (err) {
      Document.documents.update({
        _id: fork._id,
      }, {
        $set: {
          hasContentModifyLock: null,
        },
      });
    }
  }
}

// Schedules a rebase of all children (forks) of a document identified by
// "documentId" for (potential) new content available on the document.
// TODO: Use a background job for this.
Content.scheduleRebase = function scheduleRebase(documentId) {
  Meteor.setTimeout(() => {
    rebaseSteps(documentId);
  }, 100);
};

// This assumes to be called inside locked content documents so that
// content documents do not get modified and all still belong to
// content linked with provided "rebasedCount".
Content.getCurrentState = function getCurrentState(contentKey, rebasedCount) {
  const key = `${contentKey}/${rebasedCount}`;

  let doc;
  let version;
  if (documents.has(key)) {
    ({doc, version} = documents.get(key));
  }
  else {
    doc = schema.topNodeType.createAndFill();
    version = 0;
  }

  this.documents.find({
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
    updateCurrentState(contentKey, rebasedCount, doc, version);
  });

  if (documents.has(key)) {
    const {version: currentVersion, doc: currentDoc} = documents.get(key);
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
    assert.strictEqual(currentVersion, version);
  }

  return {doc, version};
};

Content._addSteps = function addSteps(args, user) {
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

  // We need a user reference.
  assert(user);

  const steps = args.steps.map((step) => {
    return Step.fromJSON(schema, step);
  });

  const onlyHighlights = stepsAreOnlyHighlights(steps);

  // We do not use "CREATE" permission because from the point of the steps we
  // are always updating the (potentially) empty already created document.
  const allowedPermissions = [Document.PERMISSIONS.UPDATE];
  if (onlyHighlights) {
    allowedPermissions.push(Document.PERMISSIONS.COMMENT_CREATE);
  }

  // "Document.restrictQuery" makes sure that we are not updating (with non-highlights steps)
  // a published document or a document which was merged into the parent document.
  const query = Document.restrictQuery({
    contentKey: args.contentKey,
  }, allowedPermissions, user);

  let doc = null;
  let version = null;
  let documentId = null;

  // We acquire the append lock on the document. We do not really need this (currently) for
  // the logic below, but it makes sure that merging and rebasing cannot happen at the same.
  // We use two locks because this lock does not make editor read-only in clients.
  const changes = Document.lock(query, true, false, (lockedDocumentId) => {
    // We do not have to fail, we just leave to the client to retry.
    return 0;
  }, (lockedDocumentId) => {
    documentId = lockedDocumentId;

    // We fetch the document here to make sure we have the most recent (and locked) state.
    const document = Document.documents.findOne({
      $and: [
        {
          _id: documentId,
        },
        query,
      ],
    }, {
      fields: {
        _id: 1,
        publishedAt: 1,
        mergeAcceptedAt: 1,
        hasContentAppendLock: 1,
        rebasedCount: 1,
      },
    });

    if (!document) {
      throw new Meteor.Error('not-found', "Document cannot be found.");
    }

    assert(document.hasContentAppendLock);

    assert(!(document.isPublished() || document.isMergeAccepted()) || onlyHighlights);

    ({doc, version} = this.getCurrentState(args.contentKey, document.rebasedCount));

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

      updateCurrentState(args.contentKey, document.rebasedCount, doc, version);
    }

    Document.documents.update({
      _id: documentId,
      version: {
        // We update only if we have a newer version then already in the database.
        $lt: version,
      },
    }, {
      $set: {
        version,
        body: doc.toJSON(),
        title: extractTitle(doc),
        updatedAt: timestamp,
        lastActivity: timestamp,
      },
    });

    return version - args.currentVersion;
  });

  if (changes) {
    assert(doc);
    assert(version !== null);
    assert(documentId);

    // Content has been just changed, we have to rebase new content to
    // all children (forks) of this document.
    Content.scheduleRebase(documentId);

    // TODO: Use a background job for this.
    Meteor.setTimeout(() => {
      Comment.filterOrphan(documentId, doc, version);
    }, 100);
  }

  return changes;
};

Meteor.methods({
  'Content.addSteps'(args) {
    const user = Meteor.user(_.extend(User.REFERENCE_FIELDS(), User.CHECK_PERMISSIONS_FIELDS()));

    return Content._addSteps(args, user);
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

    return Content.documents.find({
      contentKeys: args.contentKey,
    }, {
      fields: Content.PUBLISH_FIELDS(),
    });
  });
});
