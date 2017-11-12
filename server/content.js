import {check, Match} from 'meteor/check';
import {Meteor} from 'meteor/meteor';

import {Step} from 'prosemirror-transform';
import {schema} from 'prosemirror-schema-basic';

import {Content} from '/lib/content';
import {User} from '/lib/user';

// A special case which is not using ValidatedMethod.
Meteor.methods({
  'Content.addSteps'(args) {
    check(args, {
      contentKey:  Match.DocumentId,
      currentVersion: Match.Integer,
      steps: [Step],
      clientId: Match.DocumentId
    });

    const user = Meteor.user(User.REFERENCE_FIELDS());
    if (!user) {
      throw new Meteor.Error('unauthorized', "Unauthorized.");
    }

    // TODO: Check more permissions?

    let addedCount = 0;
    const latestContent = Content.documents.findOne({contentKey: args.contentKey}, {sort: {version: -1}, fields: {version: 1}});

    if (latestContent.version !== args.currentVersion) {
      return addedCount;
    }

    const createdAt = new Date();

    for (let step of args.steps) {
      const {numberAffected, insertedId} = Content.documents.upsert({
        contentKey: args.contentKey,
        version: args.currentVersion + addedCount + 1
      }, {
        $setOnInsert: {
          createdAt: createdAt,
          author: user.getReference(),
          clientId: args.clientId,
          // We do not store steps serialized wth EJSON but normal JSON to make it cleaner.
          step: step.toJSON()
        }
      });

      if (!insertedId) {
        break;
      }

      addedCount++;
    }

    return addedCount;
  }
});

Meteor.publish('Content.feed', function (args) {
  check(args, {
    contentKey: Match.DocumentId
  });

  this.enableScope();

  const handle = Content.documents.find({
    contentKey: args.contentKey
  }, {
    fields: Content.PUBLISH_FIELDS()
  // We do not store steps serialized wth EJSON but
  // normal JSON so we have to manually deserialize them.
  }).observeChanges({
    added: (id, fields) => {
      if (fields.step) {
        fields.step = Step.fromJSON(schema, fields.step);
      }
      this.added(Content.Meta.collection._name, id, fields);
    },

    changed: (id, fields) => {
      if (fields.step) {
        fields.step = Step.fromJSON(schema, fields.step);
      }
      this.changed(Content.Meta.collection._name, id, fields);
    },

    removed: (id) => {
      this.removed(Content.Meta.collection._name, id);
    }
  });

  this.onStop(() => {
    handle.stop();
  });

  this.ready();
});
