/* eslint-env mocha */
/* eslint-disable func-names, prefer-arrow-callback */

import {Random} from 'meteor/random';

import {assert} from 'chai';

import {Content} from '/lib/documents/content';
import {Document} from '/lib/documents/document';
import {User} from '/lib/documents/user';
import {documentFind} from '/lib/utils.app-test';

// Augment "User" class.
import '../auth-passwordless';

describe('document', function () {
  const username = `user${Random.id()}`;

  before(async function () {
    await User.passwordlessSignIn({username});

    const {contentKey, _id: documentId} = await Document.create({});

    this.contentKey = contentKey;
    this.documentId = documentId;
  });

  it('can be populated with content', async function () {
    const clientId = Random.id();

    const changes = await Content.addSteps({
      clientId,
      contentKey: this.contentKey,
      currentVersion: 0,
      steps: [{
        stepType: 'replace',
        from: 3,
        to: 3,
        slice: {
          content: [{
            type: 'text',
            text: 't',
          }],
        },
      }, {
        stepType: 'replace',
        from: 4,
        to: 4,
        slice: {
          content: [{
            type: 'text',
            text: 'e',
          }],
        },
      }, {
        stepType: 'replace',
        from: 5,
        to: 5,
        slice: {
          content: [{
            type: 'text',
            text: 's',
          }],
        },
      }, {
        stepType: 'replace',
        from: 6,
        to: 6,
        slice: {
          content: [{
            type: 'text',
            text: 't',
          }],
        },
      }],
    });

    assert.equal(changes, 4);

    const documents = await documentFind({_id: this.documentId});

    assert.equal(documents.length, 1);
    assert.deepEqual(documents[0].body, {
      type: 'doc',
      content: [{
        type: 'title',
      }, {
        type: 'paragraph',
        content: [{
          type: 'text',
          text: 'test',
        }],
      }],
    });
  });

  it('cannot be forked if it\'s not published', async function () {
    try {
      await Document.fork({
        documentId: this.documentId,
      });
      assert.fail();
    }
    catch (err) {
      assert.equal(err.error, 'not-found');
    }
  });

  it('can be published', async function () {
    await Document.publish({
      documentId: this.documentId,
    });
    const document = (await documentFind({_id: this.documentId}))[0];
    assert.notEqual(document.publishedBy, null);
    assert.notEqual(document.publishedAt, null);
  });

  it('can be forked if it\'s published', async function () {
    await Document.fork({
      documentId: this.documentId,
    });
    const document = (await documentFind({'forkedFrom._id': this.documentId}))[0];
    assert.equal(document.forkedFrom._id, this.documentId);
    assert.equal(document.forkedAtVersion, 4);
  });

  it('can be merged', async function () {
    const clientId = Random.id();
    let forkedDocument = (await documentFind({'forkedFrom._id': this.documentId}))[0];
    const forkedDocumentId = forkedDocument._id;

    assert.equal(forkedDocument.mergeAcceptedBy, null);
    assert.equal(forkedDocument.mergeAcceptedAt, null);

    await Content.addSteps({
      clientId,
      contentKey: forkedDocument.contentKey,
      currentVersion: forkedDocument.version,
      steps: [{
        stepType: 'replace',
        from: 7,
        to: 7,
        slice: {
          content: [{
            type: 'text',
            text: '.',
          }],
        },
      }],
    });
    await Document.acceptMerge({
      documentId: forkedDocumentId,
    });

    const parentDocument = (await documentFind({_id: this.documentId}))[0];

    assert.deepEqual(parentDocument.body, {
      type: 'doc',
      content: [{
        type: 'title',
      }, {
        type: 'paragraph',
        content: [{
          type: 'text',
          text: 'test.',
        }],
      }],
    });

    forkedDocument = (await documentFind({_id: forkedDocumentId}))[0];
    assert.notEqual(forkedDocument.mergeAcceptedBy, null);
    assert.notEqual(forkedDocument.mergeAcceptedAt, null);
  });
});

