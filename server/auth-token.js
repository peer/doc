import {Accounts} from 'meteor/accounts-base';
import {Match} from 'meteor/check';
import {Meteor} from 'meteor/meteor';
import {_} from 'meteor/underscore';

import crypto from 'crypto';

import {User} from '/lib/documents/user';
import {Nonce} from '/server/documents/nonce';
import {check} from '/server/check';

const baseToMap = {
  _: '/',
  '-': '+',
  '.': '=',
};

function decrypt(tokenBase, keyHex) {
  const token = Buffer.from(tokenBase.replace(/[-_.]/g, (c) => {
    return baseToMap[c];
  }), 'base64');
  const iv = token.slice(0, 12);
  const authTag = token.slice(12, 28);
  const ciphertext = token.slice(28);
  const decipher = crypto.createDecipheriv('aes-128-gcm', Buffer.from(keyHex, 'hex'), iv);
  decipher.setAuthTag(authTag);
  const json = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  const data = JSON.parse(json);
  // Store nonce into the database. This fails if nonce already exists.
  Nonce.addNonce({nonce: data.nonce});
  return _.omit(data, 'nonce');
}

export function createOrGetUser(userDescriptor) {
  check(userDescriptor, Match.ObjectIncluding({
    // TODO: Check that it is an URL.
    avatar: Match.NonEmptyString,
    username: Match.NonEmptyString,
    id: Match.Any,
    email: Match.EMail,
  }));

  // eslint-disable-next-line no-param-reassign
  userDescriptor = _.pick(userDescriptor, 'avatar', 'username', 'id', 'email');

  // eslint-disable-next-line no-unused-vars
  const {numberAffected, insertedId} = User.documents.upsert({
    'services.usertoken.id': userDescriptor.id,
  }, {
    $set: {
      username: userDescriptor.username,
      avatar: userDescriptor.avatar,
      'services.usertoken': userDescriptor,
      // TODO: This might override an e-mail from some other service.
      emails: [{
        address: userDescriptor.email,
        verified: true,
      }],
    },
  });

  let user;
  if (insertedId) {
    user = User.documents.findOne({
      _id: insertedId,
    }, {
      fields: _.extend(User.REFERENCE_FIELDS(), User.CHECK_PERMISSIONS_FIELDS()),
    });
  }
  else {
    user = User.documents.findOne({
      'services.usertoken.id': userDescriptor.id,
    }, {
      fields: _.extend(User.REFERENCE_FIELDS(), User.CHECK_PERMISSIONS_FIELDS()),
    });
  }

  // Sanity check.
  if (!user) {
    throw new Error("Failed to create a new account.");
  }

  return user;
}

// TODO: Instead of manually creating a user document, we should define a Meteor external service and use its API.
// TODO: If user with same verified e-mail already exist, we should maybe try to merge documents?
// TODO: What if user with same username already exists from some other service?
export function createUserFromToken(userToken) {
  if (Accounts._options.forbidClientAccountCreation) {
    throw new Meteor.Error('forbidden', "Sign ups forbidden.");
  }

  // Obtaining shared secret from "settings.json". We read it here
  // and not outside of the function so that we can set it during testing.
  const {tokenSharedSecret} = Meteor.settings;

  const decryptedToken = decrypt(userToken, tokenSharedSecret);

  return createOrGetUser(decryptedToken);
}

// A special case which is not using ValidatedMethod because client side
// differs a lot from the server side and there is no client stub.
Meteor.methods({
  'User.createUserAndSignInWithUserToken'(...allArgs) {
    const args = allArgs[0];

    return Accounts._loginMethod(this, 'User.createUserAndSignInWithUserToken', allArgs, 'usertoken', () => {
      check(args, {
        userToken: Match.NonEmptyString,
      });

      const {userToken} = args;

      // Client gets logged in as the new user afterwards.
      return {userId: createUserFromToken(userToken)._id};
    });
  },
});
