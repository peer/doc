/* eslint-env mocha */
/* eslint-disable func-names, prefer-arrow-callback */

import {HTTP} from 'meteor/http';
import {Meteor} from 'meteor/meteor';
import {Random} from 'meteor/random';

import {assert} from 'chai';
import crypto from 'crypto';

import {User} from '/lib/documents/user';
import {Document} from '/lib/documents/document';
import {waitForDatabase} from '/server/utils.app-test';

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
  this.timeout(10000);

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

    // Wait for all PeerDB activity to have time to run.
    waitForDatabase();
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

  it('should allow publishing, forking, and merging', function () {
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
    assert.isNotOk(Document.documents.findOne({_id: documentId}).isMergeAccepted());

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
    assert.isNotOk(Document.documents.findOne({_id: documentId}).isMergeAccepted());

    userToken = encrypt(userPayload, keyHex);

    response = HTTP.post(`${apiEndpoint}/fork/${documentId}`, {
      params: {
        user: userToken,
      },
      data: {},
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.data.status, 'success');

    const forkId = response.data.documentId;

    assert.isNotOk(Document.documents.findOne({_id: forkId}).isPublished());
    assert.isNotOk(Document.documents.findOne({_id: forkId}).isMergeAccepted());

    userToken = encrypt(userPayload, keyHex);

    response = HTTP.post(`${apiEndpoint}/merge/${forkId}`, {
      params: {
        user: userToken,
      },
      data: {},
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.data.status, 'success');

    assert.isNotOk(Document.documents.findOne({_id: forkId}).isPublished());
    assert.isOk(Document.documents.findOne({_id: forkId}).isMergeAccepted());
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
    assert.deepEqual(Document.documents.findOne({_id: documentId}).defaultPermissions, Document.getPermissionsFromRole(Document.ROLES.VIEW));

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
    assert.equal(Document.documents.findOne({_id: documentId}).visibility, Document.VISIBILITY_LEVELS.PUBLIC);
    assert.deepEqual(Document.documents.findOne({_id: documentId}).defaultPermissions, Document.getPermissionsFromRole(Document.ROLES.COMMENT));

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
    assert.deepEqual(Document.documents.findOne({_id: documentId}).defaultPermissions, Document.getPermissionsFromRole(Document.ROLES.COMMENT));
  });

  it('should allow changing editors', function () {
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
    const user = User.documents.findOne({'services.usertoken.id': userId});

    assert.isOk(Document.documents.findOne({_id: documentId}).canUser(Document.PERMISSIONS.ADMIN, user));

    userToken = encrypt(userPayload, keyHex);

    const anotherUsername = `anotherUser${Random.id()}`;
    const anotherUserId = Random.id();
    const anotherUserPayload = {
      username: anotherUsername,
      avatar: 'https://randomuser.me/api/portraits/men/70.jpg',
      id: anotherUserId,
      email: `${anotherUsername}@example.com`,
    };

    response = HTTP.post(`${apiEndpoint}/share/${documentId}`, {
      params: {
        user: userToken,
      },
      data: {
        token_users: {
          edit: [userPayload, anotherUserPayload],
        },
      },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.data.status, 'success');

    const anotherUser = User.documents.findOne({'services.usertoken.id': anotherUserId});

    assert.isOk(Document.documents.findOne({_id: documentId}).canUser(Document.PERMISSIONS.ADMIN, user));
    assert.isOk(Document.documents.findOne({_id: documentId}).canUser(Document.PERMISSIONS.UPDATE, anotherUser));
  });
});
