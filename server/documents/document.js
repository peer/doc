import {check, Match} from 'meteor/check';
import {Meteor} from 'meteor/meteor';
import {Step, Transform} from 'prosemirror-transform';

import {Activity} from '/lib/documents/activity';
import {Content} from '/lib/documents/content';
import {Document} from '/lib/documents/document';
import {User} from '/lib/documents/user';

import {schema} from '../../lib/full-schema';

Meteor.methods({
  'Document.publish'(args) {
    check(args, {
      documentId: String,
    });

    const user = Meteor.user(User.REFERENCE_FIELDS());

    const publishedAt = new Date();

    const changed = Document.documents.update(Document.restrictQuery({
      _id: args.documentId,
    }, Document.PERMISSIONS.ADMIN, user), {
      $set: {
        publishedAt,
        updatedAt: publishedAt,
        lastActivity: publishedAt,
        publishedBy: user.getReference(),
      },
    });

    if (changed) {
      Activity.documents.insert({
        timestamp: publishedAt,
        connection: this.connection.id,
        byUser: user.getReference(),
        // We inform all followers of this document.
        // TODO: Implement once we have followers.
        forUsers: [],
        type: 'documentPublished',
        level: Activity.LEVEL.GENERAL,
        data: {
          document: {
            _id: args.documentId,
          },
        },
      });
    }
  },
  'Document.fork'(args) {
    check(args, {
      documentId: String,
    });

    const user = Meteor.user(User.REFERENCE_FIELDS());

    // We need user reference.
    if (!user || !user.hasPermission(Document.PERMISSIONS.CREATE)) {
      throw new Meteor.Error('unauthorized', "Unauthorized.");
    }
    const doc = Document.documents.findOne({
      _id: args.documentId,
    });

    const {contentKey} = doc;

    const createdAt = new Date();
    const forkContentKey = Content.Meta.collection._makeNewID();

    Content.documents.update(
      {
        contentKeys:
        {
          $elemMatch: {
            $in: [contentKey],
          },
        },
      },
      {
        $push:
        {
          contentKeys: forkContentKey,
        },
      }, {
        multi: true,
      },
    );

    const documentId = Document.documents.insert({
      contentKey: forkContentKey,
      createdAt,
      updatedAt: createdAt,
      lastActivity: createdAt,
      author: user.getReference(),
      publishedBy: null,
      publishedAt: null,
      title: doc.title,
      version: doc.version,
      body: doc.body,
      forkedFrom: doc.getReference(),
      forkedAtVersion: doc.version,
    });
    return {documentId};
  },
  'Document.undoChanges'(args) {
    check(args, {
      documentId: String,
    });

    const fork = Document.documents.findOne(
      {
        _id: args.documentId,
      },
      {
        fields: {
          contentKey: 1,
          forkedAtVersion: 1,
          forkedFrom: 1,
          _id: 1,
        },
      },
    );

    Content.documents.remove({
      version: {
        $gt: fork.forkedAtVersion,
      },
      contentKeys:
      {
        $elemMatch: {
          $in: [fork.contentKey],
        },
      },
    });

    Content.removeDocumentState({contentKey: fork.contentKey});
  },
  'Document.merge'(args) {
    check(args, {
      documentId: String,
    });

    const user = Meteor.user(User.REFERENCE_FIELDS());

    if (!user || !user.hasPermission(Document.PERMISSIONS.CREATE)) {
      throw new Meteor.Error('unauthorized', "Unauthorized.");
    }

    const fork = Document.documents.findOne(
      {
        _id: args.documentId,
      },
      {
        fields: {
          contentKey: 1,
          forkedAtVersion: 1,
          forkedFrom: 1,
          _id: 1,
        },
      },
    );

    const forkSteps = Content.documents.find(
      {
        version: {
          $gt: fork.forkedAtVersion,
        },
        contentKeys:
        {
          $elemMatch: {
            $in: [fork.contentKey],
          },
        },
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

    const original = Document.documents.findOne({
      _id: fork.forkedFrom._id,
    });

    let doc = schema.topNodeType.createAndFill();
    let transform;
    let version = 0;

    Content.documents.find({
      contentKeys: {
        $elemMatch: {
          $in: [original.contentKey],
        },
      },
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
      if (content.version > fork.forkedAtVersion) {
        if (!transform) {
          transform = new Transform(doc);
        }
        transform.step(Step.fromJSON(schema, content.step));
      }

      const result = Step.fromJSON(schema, content.step).apply(doc);

      if (!result.doc) {
        // eslint-disable-next-line no-console
        console.error("Error applying a step.", result.failed);
        throw new Meteor.Error('invalid-request', "Invalid step.");
      }
      doc = result.doc;
      version = content.version;
    });

    const originalSteps = Content.documents.find(
      {
        version: {
          $gt: fork.forkedAtVersion,
        },
        contentKeys:
        {
          $elemMatch: {
            $in: [original.contentKey],
          },
        },
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

    const shouldRebase = transform !== undefined && forkSteps.length > 0;

    if (shouldRebase) {
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

    for (let i = 0; i < forkSteps.length; i += 1) {
      const result = forkSteps[i].apply(doc);
      transform.step(forkSteps[i]);
      if (!result.doc) {
        // eslint-disable-next-line no-console
        console.error("Error applying a step.", result.failed);
        throw new Meteor.Error('invalid-request', "Invalid step.");
      }
      doc = result.doc;
    }

    if (shouldRebase) {
      for (let i = 0, mapFrom = originalSteps.length * 2; i < originalSteps.length; i += 1) {
        const mapped = originalSteps[i].map(transform.mapping.slice(mapFrom));
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

    transform.steps.forEach((x, i) => {
      if (i >= originalSteps.length) {
        version += 1;
        Content.documents.upsert({
          version,
          contentKeys: {
            $elemMatch: {
              $in: [original.contentKey],
            },
          },
        }, {
          $setOnInsert: {
            contentKeys: [original.contentKey],
            createdAt: timestamp,
            author: user.getReference(),
            clientId: args.clientId,
            step: x.toJSON(),
          },
        });
      }
    });
  },
});

Meteor.publish('Document.list', function documentList(args) {
  check(args, {});

  this.enableScope();

  this.autorun((computation) => {
    // TODO: Show unpublished documents to users with UPDATE permission.
    // TODO: Show public drafts to users.
    return Document.documents.find(Document.restrictQuery({
      publishedAt: {$ne: null},
    }, Document.PERMISSIONS.SEE), {
      fields: Document.PUBLISH_FIELDS(),
    });
  });
});

Meteor.publish('Document.one', function documentOne(args) {
  check(args, {
    documentId: Match.DocumentId,
  });

  this.autorun((computation) => {
    return Document.documents.find(Document.restrictQuery({
      _id: args.documentId,
    }, Document.PERMISSIONS.SEE), {
      fields: Document.PUBLISH_FIELDS(),
    });
  });
});

// For testing.
export {Document};
