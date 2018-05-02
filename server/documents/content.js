import {check, Match} from 'meteor/check';
import {Meteor} from 'meteor/meteor';

import {Step} from 'prosemirror-transform';

import {Document} from '/lib/documents/document';
import {Content} from '/lib/documents/content';
import {User} from '/lib/documents/user';
import {schema} from '/lib/full-schema';

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

    const user = Meteor.user(User.REFERENCE_FIELDS());

    // We need user reference.
    if (!user) {
      throw new Meteor.Error('unauthorized', "Unauthorized.");
    }

    const document = Document.documents.findOne(Document.restrictQuery({
      contentKey: args.contentKey,
    }, Document.PERMISSIONS.UPDATE, user));
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

    let addedCount = 0;

    if (latestContent.version !== args.currentVersion) {
      return addedCount;
    }

    let stepsToProcess = steps;

    if (document.isPublished()) {
      // If the document is published we immediately discard this new step
      // unless it contains highlight marks, in which case we just process those.
      stepsToProcess = steps.filter((step) => {
        if (step.mark && step.mark.type.name === 'highlight') {
          return step;
        }
        return null;
      });
      if (!stepsToProcess.length) {
        return addedCount;
      }
    }

    const createdAt = new Date();

    for (const step of stepsToProcess) {
      // eslint-disable-next-line no-unused-vars
      const {numberAffected, insertedId} = Content.documents.upsert({
        contentKey: args.contentKey,
        version: args.currentVersion + addedCount + 1,
      }, {
        $setOnInsert: {
          createdAt,
          author: user.getReference(),
          clientId: args.clientId,
          step: step.toJSON(),
        },
      });

      if (!insertedId) {
        break;
      }

      addedCount += 1;
    }

    return addedCount;
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

export {Content};
