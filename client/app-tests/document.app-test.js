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

    const {contentKeys, _id: documentId} = await Document.create({});

    this.contentKeys = contentKeys;
    this.documentId = documentId;
  });

  it('can be populated with content', async function () {
    const clientId = Random.id();

    const changes = await Content.addSteps({
      clientId,
      contentKeys: this.contentKeys,
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
});
