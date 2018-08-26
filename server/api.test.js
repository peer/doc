/* eslint-env mocha */
/* eslint-disable func-names, prefer-arrow-callback */

import {HTTP} from 'meteor/http';
import {Meteor} from 'meteor/meteor';
import {Random} from 'meteor/random';

import {assert} from 'chai';
import crypto from 'crypto';

// Enable API.
import {} from './api';
import {User} from './documents/user';
import {Document} from './documents/document';

const baseFromMap = {
  '+': '-',
  '/': '_',
  '=': '.',
};

function encrypt(inputData, keyHex) {
  const data = Object.assign({}, inputData);
  data.nonce = crypto.randomBytes(16).toString('hex');
  const json = JSON.stringify(data);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-128-gcm', Buffer.from(keyHex, 'hex'), iv);
  const buffers = [];
  buffers.push(cipher.update(json, 'utf8'));
  buffers.push(cipher.final());
  return Buffer.concat([iv, cipher.getAuthTag()].concat(buffers)).toString('base64').replace(/[+/=]/g, (c) => {
    return baseFromMap[c];
  });
}

describe('document api', function () {
  // TODO: Use path information from router instead of hard-coding the path here.
  const apiEndpoint = Meteor.absoluteUrl('document');
  const keyHex = crypto.randomBytes(16).toString('hex');
  const userId = Random.id();
  const username = `user${Random.id()}`;

  let oldTokenSharedSecret;

  before(function () {
    oldTokenSharedSecret = Meteor.settings.tokenSharedSecret;
    Meteor.settings.tokenSharedSecret = keyHex;
  });

  after(function () {
    Meteor.settings.tokenSharedSecret = oldTokenSharedSecret;

    User.documents.remove({'services.usertoken.id': userId});
  });

  it('should fail without query', function () {
    try {
      HTTP.post(apiEndpoint, {
        data: {},
      });
      assert.fail("expected exception");
    }
    catch (error) {
      assert.equal(error.response.statusCode, 400);
      assert.deepEqual(error.response.data, {status: 'error'});
    }
  });

  it('should fail without user token', function () {
    try {
      HTTP.post(apiEndpoint, {
        params: {
          foo: 'bar',
        },
        data: {},
      });
      assert.fail("expected exception");
    }
    catch (error) {
      assert.equal(error.response.statusCode, 400);
      assert.deepEqual(error.response.data, {status: 'error'});
    }
  });

  it('should fail with invalid user token', function () {
    try {
      HTTP.post(apiEndpoint, {
        params: {
          user: 'invalid',
        },
        data: {},
      });
      assert.fail("expected exception");
    }
    catch (error) {
      assert.equal(error.response.statusCode, 400);
      assert.deepEqual(error.response.data, {status: 'error'});
    }
  });

  let userToken;

  it('should allow creation with valid user token', function () {
    assert.isNotOk(User.documents.exists({'services.usertoken.id': userId}));

    const userPayload = {
      username,
      avatar: 'https://randomuser.me/api/portraits/women/70.jpg',
      id: userId,
      email: `${username}@example.com`,
    };

    userToken = encrypt(userPayload, keyHex);

    assert.notInclude(userToken, '+');
    assert.notInclude(userToken, '/');
    assert.notInclude(userToken, '=');

    const response = HTTP.post(apiEndpoint, {
      params: {
        user: userToken,
      },
      data: {},
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.data.status, 'success');
    assert.isString(response.data.documentId);
    // TODO: Use router to construct the path.
    assert.equal(response.data.path, `/document/${response.data.documentId}`);
    assert.isOk(Document.documents.exists({_id: response.data.documentId}));

    const user = User.documents.findOne({'services.usertoken.id': userId});

    assert.deepEqual(user.services.usertoken, userPayload);
    assert.equal(user.username, username);
    assert.equal(user.avatar, userPayload.avatar);
    assert.equal(user.emails[0].address, userPayload.email);
  });

  it('should not allow user token reuse', function () {
    try {
      HTTP.post(apiEndpoint, {
        params: {
          user: userToken,
        },
        data: {},
      });
      assert.fail("expected exception");
    }
    catch (error) {
      assert.equal(error.response.statusCode, 400);
      assert.deepEqual(error.response.data, {status: 'error'});
    }
  });

  it('should update user data', function () {
    assert.isOk(User.documents.exists({'services.usertoken.id': userId}));

    const userPayload = {
      username,
      avatar: 'https://randomuser.me/api/portraits/women/30.jpg',
      id: userId,
      email: `${username}_another@example.com`,
    };

    userToken = encrypt(userPayload, keyHex);

    assert.notInclude(userToken, '+');
    assert.notInclude(userToken, '/');
    assert.notInclude(userToken, '=');

    const response = HTTP.post(apiEndpoint, {
      params: {
        user: userToken,
      },
      data: {},
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.data.status, 'success');
    assert.isString(response.data.documentId);
    // TODO: Use router to construct the path.
    assert.equal(response.data.path, `/document/${response.data.documentId}`);
    assert.isOk(Document.documents.exists({_id: response.data.documentId}));

    const user = User.documents.findOne({'services.usertoken.id': userId});

    assert.deepEqual(user.services.usertoken, userPayload);
    assert.equal(user.username, username);
    assert.equal(user.avatar, userPayload.avatar);
    assert.equal(user.emails[0].address, userPayload.email);
  });

  it('should allow publishing', function () {
    const userPayload = {
      username,
      avatar: 'https://randomuser.me/api/portraits/women/70.jpg',
      id: userId,
      email: `${username}@example.com`,
    };

    userToken = encrypt(userPayload, keyHex);

    let response;
    response = HTTP.post(apiEndpoint, {
      params: {
        user: userToken,
      },
      data: {},
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.data.status, 'success');

    const documentId = response.data.documentId;

    assert.isNotOk(Document.documents.findOne({_id: documentId}).isPublished());

    userToken = encrypt(userPayload, keyHex);

    response = HTTP.post(`${apiEndpoint}/publish/${documentId}`, {
      params: {
        user: userToken,
      },
      data: {},
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.data.status, 'success');
    assert.isOk(Document.documents.findOne({_id: documentId}).isPublished());
  });

  it('should allow changing visibility', function () {
    const userPayload = {
      username,
      avatar: 'https://randomuser.me/api/portraits/women/70.jpg',
      id: userId,
      email: `${username}@example.com`,
    };

    userToken = encrypt(userPayload, keyHex);

    let response;
    response = HTTP.post(apiEndpoint, {
      params: {
        user: userToken,
      },
      data: {},
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.data.status, 'success');

    const documentId = response.data.documentId;

    assert.equal(Document.documents.findOne({_id: documentId}).visibility, Document.VISIBILITY_LEVELS.PRIVATE);
    assert.deepEqual(Document.documents.findOne({_id: documentId}).defaultPermissions, Document.getRolePermissions(Document.ROLES.VIEW));

    userToken = encrypt(userPayload, keyHex);

    response = HTTP.post(`${apiEndpoint}/share/${documentId}`, {
      params: {
        user: userToken,
      },
      data: {
        visibility: true,
      },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.data.status, 'success');
    assert.equal(Document.documents.findOne({_id: documentId}).visibility, Document.VISIBILITY_LEVELS.LISTED);
    assert.deepEqual(Document.documents.findOne({_id: documentId}).defaultPermissions, Document.getRolePermissions(Document.ROLES.COMMENT));

    userToken = encrypt(userPayload, keyHex);

    response = HTTP.post(`${apiEndpoint}/share/${documentId}`, {
      params: {
        user: userToken,
      },
      data: {
        visibility: false,
      },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.data.status, 'success');
    assert.equal(Document.documents.findOne({_id: documentId}).visibility, Document.VISIBILITY_LEVELS.PRIVATE);
    assert.deepEqual(Document.documents.findOne({_id: documentId}).defaultPermissions, Document.getRolePermissions(Document.ROLES.COMMENT));
  });
});
