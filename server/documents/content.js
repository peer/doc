import {check, Match} from 'meteor/check';
import {Meteor} from 'meteor/meteor';

import {Step} from 'prosemirror-transform';

import {Document} from '/lib/documents/document';
import {Content} from '/lib/documents/content';
import {User} from '/lib/documents/user';
import {schema} from '/lib/schema';

// Server-side only method, so we are not using ValidatedMethod.
Meteor.methods({
  'Content.addSteps'(args) {
    check(args, {
      contentKey: Match.DocumentId,
      currentVersion: Match.Integer,
      steps: [Step],
      clientId: Match.DocumentId,
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
    let stepsToProcess = args.steps;

    if (document.isPublished()) {
      // If the document is published we immediately discard this new step
      // unless it contains highlight marks, in which case we just process those.
      stepsToProcess = args.steps.filter((step) => {
        if (step.mark && step.mark.type.name === 'highlight') {
          return step;
        }
        return null;
      });
      if (!stepsToProcess || !stepsToProcess.length) {
        return addedCount;
      }
    }

    if (latestContent.version !== args.currentVersion) {
      return addedCount;
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
          // We do not store steps serialized wth EJSON but normal JSON to make it cleaner.
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

  // eslint-disable-next-line consistent-return
  this.autorun((computation) => {
    const documentExists = Document.documents.exists(Document.restrictQuery({
      contentKey: args.contentKey,
    }, Document.PERMISSIONS.SEE));
    if (!documentExists) {
      return [];
    }

    Content.documents.find({
      contentKey: args.contentKey,
    }, {
      fields: Content.PUBLISH_FIELDS(),
    // We do not store steps serialized wth EJSON but
    // normal JSON so we have to manually deserialize them.
    }).observeChanges({
      added: (id, fields) => {
        if (fields.step) {
          fields.step = Step.fromJSON(schema, fields.step); // eslint-disable-line no-param-reassign
        }
        this.added(Content.Meta.collection._name, id, fields);
      },

      changed: (id, fields) => {
        if (fields.step) {
          fields.step = Step.fromJSON(schema, fields.step); // eslint-disable-line no-param-reassign
        }
        this.changed(Content.Meta.collection._name, id, fields);
      },

      removed: (id) => {
        this.removed(Content.Meta.collection._name, id);
      },
    });

    this.ready();
  });
});
