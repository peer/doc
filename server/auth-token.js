import {Accounts} from 'meteor/accounts-base';
import {check, Match} from 'meteor/check';
import {Meteor} from 'meteor/meteor';
import crypto from 'crypto';

import {AppCivistNonce} from '/lib/documents/appcivist-nonce';
import {User} from '/lib/documents/user';

const baseToMap = {
  '-': '+',
  _: '/',
  '.': '=',
};

export function decrypt(tokenBase, keyHex) {
  const token = Buffer.from(tokenBase.replace(/[-_.]/g, (c) => {
    return baseToMap[c];
  }), 'base64');
  const iv = token.slice(0, 12);
  const authTag = token.slice(12, 28);
  const ciphertext = token.slice(28);
  const decipher = crypto.createDecipheriv('aes-128-gcm', Buffer.from(keyHex, 'hex'), iv);
  decipher.setAuthTag(authTag);
  const json = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  return JSON.parse(json);
}

/**
 * Creates and user from one of two ways:
 *  - From an username (e.g.: when creating an user internally from PeerDoc)
 *  - from an userToken (e.g.: when creating an user from AppCivist or another external source).
 * @returns Created User
 */
export function createUserAndSignIn({username, userToken}) {
  check({username, userToken}, {
    username: Match.OneOf(Match.RegexString(User.VALID_USERNAME), undefined),
    userToken: Match.OneOf(Object, undefined),
  });
  let result = null;

  // This handle the first case, when no token is provided (e.g.: when creating an user internally).
  if (!userToken) {
    // Does user already exists? Then we just sign the user in.
    const user = Accounts.findUserByUsername(username);
    if (user) {
      return user;
    }

    // Otherwise we create a new user.
    result = Accounts.createUser({username});
  }
  else {
    // If the user creation came from token.
    // Does user already exists? Then we just sign the user in.
    const user = User.documents.findOne({"services.usertoken.id": userToken.id});
    if (user) {
      return user;
    }

    // Otherwise we create a new user.
    const userTokenWithoutNonce = Object.assign({}, userToken);
    delete userTokenWithoutNonce.nonce; // we don't need to store the nonce
    const userId = User.documents.insert({
      username: userToken.username,
      services: {
        usertoken: userTokenWithoutNonce,
      },
    });
    result = User.documents.findOne({_id: userId});
  }
  // Safety belt. createUser is supposed to throw on error.
  if (!result) {
    throw new Error("Failed to insert a new user.");
  }

  // Client gets logged in as the new user afterwards.
  return result;
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
      if (Accounts._options.forbidClientAccountCreation) {
        return {
          error: new Meteor.Error('forbidden', "Sign ups forbidden."),
        };
      }

      const {userToken} = args;

      // Obtaining common keyHex between AppCivist and PeerDoc from settings.json
      const {keyHex} = Meteor.settings;

      const decryptedToken = decrypt(userToken, keyHex);

      AppCivistNonce.addNonce({nonce: decryptedToken.nonce});

      return {userId: createUserAndSignIn({userToken: decryptedToken})._id};
    });
  },
});
