import {Match} from 'meteor/check';
import {Meteor} from 'meteor/meteor';
import {_} from 'meteor/underscore';

import assert from 'assert';
import util from 'util';
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

const scheduledRebase = new Set();

function updateCurrentState(contentKey, rebasedAtVersion, doc, version) {
  const key = `${contentKey}/${rebasedAtVersion}`;

  if (documents.has(key)) {
    if (version > documents.get(key).version) {
      documents.set(key, {doc, version});
    }
  }
  else {
    documents.set(key, {doc, version});
  }
}

// Returns a transform with steps that come after existing shared steps.
function getNewStepsTransform(contentKey, otherContentKey) {
  // Transform after the rebase point.
  let transform = null;
  const contents = [];

  let doc = schema.topNodeType.createAndFill();

  // Populate the transform with fork's content documents.
  Content.documents.find({
    contentKeys: contentKey,
    version: {
      $gt: 0,
    },
  }, {
    sort: {
      version: 1,
    },
    // We do not transform documents because we are using documents
    // directly to re-insert rebased steps.
    transform: null,
  }).forEach((content) => {
    const step = Step.fromJSON(schema, content.step);

    let result = null;
    if (!_.contains(content.contentKeys, otherContentKey) && transform === null) {
      transform = new Transform(doc);
    }

    if (transform === null) {
      result = step.apply(doc);
    }
    else {
      result = transform.maybeStep(step);
      contents.push(content);
    }

    if (result.failed) {
      // eslint-disable-next-line no-console
      console.error("Error applying a step.", result.failed);
      throw new Meteor.Error('internal-error', "Invalid step.");
    }

    // This is needed only while we are processing shared steps,
    // but we simply do it always to simplify the code.
    doc = result.doc;
  });

  // Fork might not have any additional steps beyond the shared steps.
  if (transform === null) {
    transform = new Transform(doc);
  }

  assert.strictEqual(transform.steps.length, contents.length);

  return {transform, contents};
}

// If the top document has steps A, and has a fork which we see here as a parent document,
// then the parent document has steps [A, C], where C are new steps the parent document
// has. A fork of that parent document then has [A, C, D] steps, where D are new steps
// the fork has. At this time [A, C] are shared steps between the parent document and
// the fork.
// Now, if the top document gets additional steps merged in, it has then steps [A, B].
// This means the parent document has to be rebased. After rebasing happens, the parent
// document has steps [A, B, C'], where C' are rebased C steps on top of B.
// Now also the fork has to be rebased. The parent document shares with the fork steps
// A and has new steps B and rebased steps C'. To rebase the fork's steps [A, C, D]
// we create a transform of [C, D] steps. We then undo D and C to get [A, C, D, -D, -C].
// Then we add new steps from the parent document B to get [A, C, D, -D, -C, B].
// We then rebase C into C' (it should be equal to parent document's C') and rebase
// D into D' and add them to get [A, C, D, -D, -C, B, C', D']. We store D' as
// rebased steps on top of parent document's [A, B, C'] to get fork's steps [A, B, C', D'].
function rebaseSteps(parentDocumentId) {
  const parentDocumentQuery = {
    _id: parentDocumentId,
  };

  // Optimization. If there are no potential forks, do not lock anything.
  if (!Document.documents.exists({
    'forkedFrom._id': parentDocumentId,
    // Document should not be published or merged.
    publishedAt: null,
    publishedBy: null,
    mergeAcceptedAt: null,
    mergeAcceptedBy: null,
  })) {
    return;
  }

  // It is important that we lock in this order (parent document first, then fork)
  // because "_acceptMerge" is doing it in the same order as well. Otherwise it
  // could happen that we end up in a deadlock.
  Document.lock(parentDocumentQuery, true, true, (lockedParentDocumentId) => {
    if (lockedParentDocumentId) {
      Content.scheduleRebase(parentDocumentId);
    }
  }, (lockedParentDocumentId) => {
    assert.strictEqual(lockedParentDocumentId, parentDocumentId);

    // We fetch the document here to make sure we have the most recent (and locked) state.
    const parentDocument = Document.documents.findOne({
      _id: parentDocumentId,
    });

    // Document does not exist anymore?
    if (!parentDocument) {
      return;
    }

    const forkQuery = {
      'forkedFrom._id': parentDocumentId,
      // Document should not be published or merged.
      publishedAt: null,
      publishedBy: null,
      mergeAcceptedAt: null,
      mergeAcceptedBy: null,
      // Only if there are new steps available.
      rebasedAtVersion: {
        $lt: parentDocument.version,
      },
    };

    Document.documents.find(forkQuery, {
      fields: {
        _id: 1,
      },
    }).forEach((forkIndex) => {
      Document.lock({_id: forkIndex._id}, true, true, (forkId) => {
        if (forkId) {
          Content.scheduleRebase(parentDocumentId);
        }
      }, (forkId) => {
        assert.strictEqual(forkId, forkIndex._id);

        // We fetch the document here to make sure we have the most recent (and locked) state.
        const fork = Document.documents.findOne({
          $and: [
            {
              _id: forkId,
            },
            forkQuery,
          ],
        });

        // Document does not have to be rebased anymore, or it does not exist anymore.
        if (!fork) {
          return;
        }

        // Get parent document's steps that are not shared with the fork.
        // They include new steps but also rebased steps which might be previously
        // part of the fork's steps (shared with the parent).
        const newAndRebasedParentDocumentSteps = Content.documents.find({
          $and: [{
            contentKeys: parentDocument.contentKey,
          }, {
            contentKeys: {$ne: fork.contentKey},
          }],
        }, {
          sort: {
            version: 1,
          },
          transform: null,
        }).map((x) => {
          return Step.fromJSON(schema, x.step);
        });

        // This should not really happen (because of the "forkQuery" above), but it
        // looks like parent document does not have new steps which are not
        // already in the fork.
        if (!newAndRebasedParentDocumentSteps.length) {
          return;
        }

        // Transform of fork steps that come after existing shared steps.
        const {transform, contents} = getNewStepsTransform(fork.contentKey, parentDocument.contentKey);

        const newForkStepsAndRebasedInParentDocumentStepsCount = transform.steps.length;
        const newForkStepsCount = fork.version - fork.rebasedAtVersion;
        const rebasedInParentDocumentStepsCount = newForkStepsAndRebasedInParentDocumentStepsCount - newForkStepsCount;
        const newParentDocumentStepsCount = newAndRebasedParentDocumentSteps.length - rebasedInParentDocumentStepsCount;

        assert(newForkStepsAndRebasedInParentDocumentStepsCount >= 0, `${newForkStepsAndRebasedInParentDocumentStepsCount}`);
        assert(newForkStepsCount >= 0, `${newForkStepsCount}`);
        assert(rebasedInParentDocumentStepsCount >= 0, `${rebasedInParentDocumentStepsCount}`);
        assert(newParentDocumentStepsCount >= 0, `${newParentDocumentStepsCount}`);

        // The following rebasing logic is equal to "rebaseSteps" function from "prosemirror-collab".
        // The difference is that instead of silently ignoring the failed rebased steps, we do something about them.

        // We have to make another transform for rebasing to work correctly.
        // See: https://github.com/ProseMirror/prosemirror/issues/874
        // TODO: Remove in the future if this is fixed in ProseMirror.
        const rebaseTransform = new Transform(transform.doc);

        // We first undo fork's new steps and then steps which have been rebased in the parent document.
        // So all steps available in the transform (all steps after existing shared steps).
        for (let i = newForkStepsAndRebasedInParentDocumentStepsCount - 1; i >= 0; i -= 1) {
          rebaseTransform.step(transform.steps[i].invert(transform.docs[i]));
        }

        // Then we add new steps from the parent document.
        for (let i = 0; i < newParentDocumentStepsCount; i += 1) {
          rebaseTransform.step(newAndRebasedParentDocumentSteps[i]);
        }

        const rebasedNewForkSteps = [];
        // Redo steps which have been rebased in the parent document and then fork's new steps.
        for (let i = 0, mapFrom = newForkStepsAndRebasedInParentDocumentStepsCount; i < newForkStepsAndRebasedInParentDocumentStepsCount; i += 1) {
          const step = transform.steps[i];
          const mapped = step.map(rebaseTransform.mapping.slice(mapFrom));
          mapFrom -= 1;
          let result = null;
          // eslint-disable-next-line no-cond-assign
          if (mapped && !(result = rebaseTransform.maybeStep(mapped)).failed) {
            rebaseTransform.mapping.setMirror(mapFrom, rebaseTransform.steps.length - 1);
            if (i < rebasedInParentDocumentStepsCount) {
              assert.deepStrictEqual(mapped.toJSON(), newAndRebasedParentDocumentSteps[newParentDocumentStepsCount + i].toJSON());
            }
            else {
              rebasedNewForkSteps.push({step: mapped, failed: null});
            }
          }
          else if (i < rebasedInParentDocumentStepsCount) {
            if (!mapped) {
              // eslint-disable-next-line no-console
              console.error("Unexpected failed mapping.", util.inspect(step.toJSON(), {depth: null}));
              throw new Meteor.Error('internal-error', "Unexpected failed mapping.");
            }
            else {
              // eslint-disable-next-line no-console
              console.error("Unexpected error applying a step.", result.failed, util.inspect(step.toJSON(), {depth: null}));
              throw new Meteor.Error('internal-error', "Unexpected invalid step.");
            }
          }
          else if (!mapped) {
            rebasedNewForkSteps.push({step, failed: "Failed mapping."});
          }
          else {
            rebasedNewForkSteps.push({step, failed: result.failed});
          }
        }

        assert.strictEqual(newForkStepsCount, rebasedNewForkSteps.length);

        // Remove fork's "contentKey" from fork's old steps (those which are not
        // shared with the parent document). We do not just remove these documents
        // because some other fork might depend on them.
        let changed = Content.documents.update({
          $and: [{
            contentKeys: fork.contentKey,
          }, {
            contentKeys: {$ne: parentDocument.contentKey},
          }],
        }, {
          $pull: {
            contentKeys: fork.contentKey,
          },
        }, {
          multi: true,
        });

        assert.strictEqual(changed, newForkStepsAndRebasedInParentDocumentStepsCount);

        // Remove all documents which have now empty "contentKeys". We remove them here
        // because we have an index on "contentKeys" (and "version') and we do not want to have
        // duplicate documents with empty "contentKeys" and same "version" value by accident.
        Content.documents.remove({contentKeys: []});

        // Add parent document's steps to the fork.
        changed = Content.documents.update({
          $and: [{
            contentKeys: parentDocument.contentKey,
          }, {
            contentKeys: {$ne: fork.contentKey},
          }],
        }, {
          $addToSet: {
            contentKeys: fork.contentKey,
          },
        }, {
          multi: true,
        });

        assert.strictEqual(changed, newAndRebasedParentDocumentSteps.length);

        let version = parentDocument.version;

        // "newForkStepsCount" is equal to "rebasedNewForkSteps.length".
        for (let i = 0; i < newForkStepsCount; i += 1) {
          const rebasedStep = rebasedNewForkSteps[i];

          if (rebasedStep.failed) {
            // TODO: Do something about failed steps.
            // eslint-disable-next-line no-console
            console.error("Failed step during rebasing.", rebasedStep.failed, util.inspect(rebasedStep.step.toJSON(), {depth: null}));
          }
          else {
            version += 1;

            // We start without "_id" field.
            const content = _.omit(contents[rebasedInParentDocumentStepsCount + i], '_id');

            _.extend(content, {
              version,
              contentKeys: [fork.contentKey],
              step: rebasedStep.step.toJSON(),
            });

            // We just directly insert (and not do an upsert) because there should not
            // be existing documents matching the "contentKey" and "version".
            Content.documents.insert(content);
          }
        }

        const timestamp = new Date();
        const rebasedAtVersion = parentDocument.version;

        Document.documents.update({
          _id: fork._id,
        }, {
          $set: {
            version,
            rebasedAtVersion,
            body: rebaseTransform.doc.toJSON(),
            updatedAt: timestamp,
            lastActivity: timestamp,
            title: extractTitle(rebaseTransform.doc),
          },
        });

        updateCurrentState(fork.contentKey, rebasedAtVersion, rebaseTransform.doc, version);

        Content.scheduleRebase(fork._id);
      });
    });
  });
}

// Schedules a rebase of all children (forks) of a document identified by
// "documentId" for (potential) new content available on the document.
// TODO: Use a background job for this.
Content.scheduleRebase = function scheduleRebase(documentId) {
  if (scheduledRebase.has(documentId)) {
    return;
  }
  scheduledRebase.add(documentId);

  Meteor.setTimeout(() => {
    scheduledRebase.delete(documentId);
    rebaseSteps(documentId);
  }, 1000);
};

// This assumes to be called inside locked content documents so that
// content documents do not get modified and all still belong to
// content linked with provided "rebasedAtVersion".
Content.getCurrentState = function getCurrentState(contentKey, rebasedAtVersion) {
  const key = `${contentKey}/${rebasedAtVersion}`;

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

    if (result.failed) {
      // eslint-disable-next-line no-console
      console.error("Error applying a step.", result.failed);
      throw new Meteor.Error('internal-error', "Invalid step.");
    }

    doc = result.doc;
    version = content.version;

    // We update current state only when we do have steps stored in the database and
    // we do not store the initial empty document and version 0 to make it slightly
    // harder to make a DoS attack my requesting state for many content keys.
    updateCurrentState(contentKey, rebasedAtVersion, doc, version);
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
  let documentIsPublished = null;

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
        rebasedAtVersion: 1,
      },
    });

    if (!document) {
      throw new Meteor.Error('not-found', "Document cannot be found.");
    }

    assert(document.hasContentAppendLock);

    assert(!(document.isPublished() || document.isMergeAccepted()) || onlyHighlights);

    documentIsPublished = document.isPublished();

    ({doc, version} = this.getCurrentState(args.contentKey, document.rebasedAtVersion));

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

      if (result.failed) {
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

      updateCurrentState(args.contentKey, document.rebasedAtVersion, doc, version);
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

    // Content has been just changed, we have to rebase new content to all children (forks) of
    // this document. Instead of running it always, we schedule only if a document is being
    // published and we know only published documents can have forks. If all documents can have
    // forks, then we have to schedule always.
    if (Meteor.settings.public.mergingForkingOfAllDocuments || documentIsPublished) {
      Content.scheduleRebase(documentId);
    }

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
    withClientId: Match.Optional(Boolean),
    withMetadata: Match.Optional(Boolean),
  });

  this.enableScope();

  this.autorun((computation) => {
    // We check that the user has permissions on content's document.
    if (!Document.existsAndCanUser({contentKey: args.contentKey}, Document.PERMISSIONS.VIEW)) {
      return [];
    }

    const fields = Content.PUBLISH_FIELDS();

    if (args.withClientId) {
      fields.clientId = 1;
    }
    if (args.withMetadata) {
      fields.createdAt = 1;
      fields.author = 1;
    }

    return Content.documents.find({
      contentKeys: args.contentKey,
    }, {
      fields,
    });
  });
});
