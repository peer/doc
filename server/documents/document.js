import {check, Match} from 'meteor/check';
import {Meteor} from 'meteor/meteor';
import {Step, Transform} from 'prosemirror-transform';

import {Activity} from '/lib/documents/activity';
import {Content} from '/lib/documents/content';
import {Document} from '/lib/documents/document';
import {User} from '/lib/documents/user';
import {extractTitle} from '/lib/utils';

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

    // TODO: Check fork permissions.
    if (!user || !user.hasPermission(Document.PERMISSIONS.CREATE)) {
      throw new Meteor.Error('unauthorized', "Unauthorized.");
    }
    const doc = Document.documents.findOne({
      _id: args.documentId,
    });

    const {contentKey} = doc;

    const createdAt = new Date();
    const forkContentKey = Content.Meta.collection._makeNewID();

    // Add forkContentKey to the existing contents.
    Content.documents.update(
      {
        contentKeys: contentKey,
      },
      {
        $addToSet: {
          contentKeys: forkContentKey,
        },
      }, {
        multi: true,
      },
    );

    // Create a new document for the forked document.
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
      lastSync: doc.version,
      isMerged: false,
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
      contentKeys: fork.contentKey,
    });

    let doc = schema.topNodeType.createAndFill();

    Content.documents.find({
      contentKeys: fork.contentKey,
      version: {
        $gt: 0,
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
      const result = Step.fromJSON(schema, content.step).apply(doc);

      if (!result.doc) {
        // eslint-disable-next-line no-console
        console.error("Error applying a step.", result.failed);
        throw new Meteor.Error('invalid-request', "Invalid step.");
      }
      doc = result.doc;
    });

    const timestamp = new Date();

    // Update document version.
    Document.documents.update({
      _id: args.documentId,
    }, {
      $set: {
        version: fork.forkedAtVersion,
        body: doc.toJSON(),
        updatedAt: timestamp,
        lastActivity: timestamp,
        title: extractTitle(doc),
      },
    });

    Content.removeDocumentState({contentKey: fork.contentKey});
  },
  'Document.rebaseStep'(args) {
    check(args, {
      documentId: String,
    });

    const user = Meteor.user(User.REFERENCE_FIELDS());

    // // TODO: Check Merge permissions.
    // if (!user || !user.hasPermission(Document.PERMISSIONS.CREATE)) {
    //   throw new Meteor.Error('unauthorized', "Unauthorized.");
    // }

    // Get forked document.
    const fork = Document.documents.findOne(
      {
        'forkedFrom._id': args.documentId,
        isMerged: {$ne: true},
      },
      {
        fields: {
          contentKey: 1,
          forkedAtVersion: 1,
          lastSync: 1,
          forkedFrom: 1,
          _id: 1,
        },
      },
    );

    if (!fork) {
      return;
    }

    // Get forked document steps.
    const forkSteps = Content.documents.find(
      {
        version: {
          $gt: fork.lastSync,
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
      return Step.fromJSON(schema, x.step);
    });

    // Get original document.
    const original = Document.documents.findOne({
      _id: fork.forkedFrom._id,
    });

    // Get original document steps that were applied after fork.
    const originalSteps = Content.documents.find(
      {
        version: {
          $gt: fork.lastSync,
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
      if (content.version > fork.lastSync) {
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
        const mapped = forkSteps[i].map(transform.mapping.slice(mapFrom));
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
        $gt: fork.lastSync,
      },
    });

    // Add original steps to forked.
    Content.documents.update({
      contentKeys: original.contentKey,
      version: {
        $gt: fork.lastSync,
      },
    }, {
      $addToSet: {
        contentKeys: fork.contentKey,
      },
    }, {
      multi: true,
    });

    version = fork.lastSync;

    // Save merge steps.
    transform.steps.forEach((x, i) => {
      if (i >= ((forkSteps.length * 2) + (originalSteps.length - 1))) {
        version += 1;
        Content.documents.upsert({
          version,
          contentKeys: fork.contentKey,
        }, {
          $setOnInsert: {
            contentKeys: [fork.contentKey],
            createdAt: timestamp,
            author: user.getReference(),
            clientId: args.clientId,
            step: x.toJSON(),
          },
        });
      }
    });

    if (fork.lastSync < original.version) {
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
          lastSync: original.version,
        },
      });
    }
  },
  'Document.merge'(args) {
    check(args, {
      documentId: String,
    });

    const user = Meteor.user(User.REFERENCE_FIELDS());

    // TODO: Check Merge permissions.
    if (!user || !user.hasPermission(Document.PERMISSIONS.CREATE)) {
      throw new Meteor.Error('unauthorized', "Unauthorized.");
    }

    const fork = Document.documents.findOne(
      {
        _id: args.documentId,
        isMerged: {$ne: true},
      },
      {
        fields: {
          _id: 1,
          title: 1,
          body: 1,
          version: 1,
          contentKey: 1,
          lastSync: 1,
          forkedFrom: 1,
        },
      },
    );

    // Get original document.
    const original = Document.documents.findOne({
      _id: fork.forkedFrom._id,
    }, {
      fields: {
        _id: 1,
        contentKey: 1,
      },
    });

    // Add original steps to forked.
    Content.documents.update({
      contentKeys: fork.contentKey,
      version: {
        $gt: fork.lastSync,
      },
    }, {
      $addToSet: {
        contentKeys: original.contentKey,
      },
    }, {
      multi: true,
    });

    const timestamp = new Date();

    // Update forked document
    Document.documents.update({
      _id: fork._id,
    }, {
      $set: {
        isMerged: true,
        lastSync: fork.version,
        updatedAt: timestamp,
        lastActivity: timestamp,
        title: fork.title,
      },
    });

    // Update original document
    Document.documents.update({
      _id: original._id,
    }, {
      $set: {
        version: fork.version,
        body: fork.body,
      },
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
