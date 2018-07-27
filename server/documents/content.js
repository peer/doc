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
import {extractTitle} from '/lib/utils';

// TODO: Make documents expire after a while.
const documents = new Map();

Content.getCurrentState = (args) => {
  let doc;
  let version;
  if (args.currentVersion && documents.has(args.contentKey)) {
    ({doc, version} = documents.get(args.contentKey));
    assert(version <= args.currentVersion);
  }
  else {
    doc = schema.topNodeType.createAndFill();
    version = 0;
  }

  Content.documents.find({
    contentKey: args.contentKey,
    version: {
      $gt: version,
      $lte: args.currentVersion,
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
  });

  return {doc, version};
};

// Server-side only method, so we are not using ValidatedMethod.
Meteor.methods({
  'Content.addSteps'(args) {
    check(args, {
      contentKey: Match.DocumentId,
      currentVersion: Match.Integer,
      steps: [Object],
      clientId: Match.DocumentId,
    });

    const steps = args.steps.map((step) => {
      return Step.fromJSON(schema, step);
    });

    const highlightSteps = [];

    const user = Meteor.user(User.REFERENCE_FIELDS());

    // We need user reference.
    if (!user) {
      throw new Meteor.Error('unauthorized', "Unauthorized.");
    }

    const document = Document.documents.findOne(Document.restrictQuery({
      contentKey: args.contentKey,
    }, Document.PERMISSIONS.UPDATE, user), {
      fields: {
        publishedAt: 1,
      },
    });
    if (!document) {
      throw new Meteor.Error('not-found', `Document cannot be found.`);
    }

    const latestContent = Content.documents.findOne({
      contentKey: args.contentKey,
    }, {
      sort: {
        version: -1,
      },
      fields: {
        version: 1,
      },
    });

    if (latestContent.version !== args.currentVersion) {
      return {stepsAdded: 0, totalSteps: args.steps.length, highlightSteps};
    }

    let stepsToProcess = steps;

    if (document.isPublished()) {
      // If the document is published we immediately discard this new step
      // unless it contains highlight marks, in which case we just process those.
      stepsToProcess = steps.filter((step) => {
        return step.mark && step.mark.type.name === 'highlight';
      });
      if (!stepsToProcess.length) {
        return {stepsAdded: 0, totalSteps: args.steps.length, highlightSteps};
      }
    }

    let {doc, version} = Content.getCurrentState(args);

    assert(version === args.currentVersion);

    const timestamp = new Date();

    for (const step of stepsToProcess) {
      const result = step.apply(doc);

      if (!result.doc) {
        // eslint-disable-next-line no-console
        throw new Meteor.Error('invalid-request', "Invalid step.");
      }

      doc = result.doc;
      version += 1;

      // Validate that the step produced a valid document.
      doc.check();

      // eslint-disable-next-line no-unused-vars
      const {numberAffected, insertedId} = Content.documents.upsert({
        version,
        contentKey: args.contentKey,
      }, {
        $setOnInsert: {
          createdAt: timestamp,
          author: user.getReference(),
          clientId: args.clientId,
          step: step.toJSON(),
        },
      });

      if (!insertedId) {
        break;
      }

      if (documents.has(args.contentKey)) {
        if (version > documents.get(args.contentKey).version) {
          documents.set(args.contentKey, {doc, version});
        }
      }
      else {
        documents.set(args.contentKey, {doc, version});
      }

      if (step.mark && step.mark.type.name === 'highlight') {
        highlightSteps.push({type: step.jsonID, highlightKey: step.mark.attrs['highlight-keys']});
      }
    }

    Document.documents.update({
      contentKey: args.contentKey,
      version: {
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

    const keys = [];

    doc.descendants((node, pos) => {
      const mark = _.find(node.marks, (m) => {
        return m.type.name === 'highlight';
      });
      if (mark) {
        keys.push(mark.attrs['highlight-keys'].split(','));
      }
    });

    Comment.filterOrphan({
      documentId: document._id,
      highlightKeys: _.flatten(keys),
      version,
    });
    return {
      stepsAdded: version - args.currentVersion,
      totalSteps: args.steps.length,
      highlightSteps: _.uniq(highlightSteps, (x) => {
        return `${x.type}-${x.highlightKey}`;
      }),
    };
  },
});

Meteor.publish('Content.list', function contentList(args) {
  check(args, {
    contentKey: Match.DocumentId,
  });

  this.enableScope();

  this.autorun((computation) => {
    const documentExists = Document.documents.exists(Document.restrictQuery({
      contentKey: args.contentKey,
    }, Document.PERMISSIONS.SEE));

    if (!documentExists) {
      return [];
    }

    return Content.documents.find({
      contentKey: args.contentKey,
    }, {
      fields: Content.PUBLISH_FIELDS(),
    });
  });
});

// For testing.
export {Content};
