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
  return JSON.parse(json);
}

// const keyHex = crypto.randomBytes(16).toString('hex');
const keyHex = 'adfb0f4077454862ee2062d3970c9c33';
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

      const decryptedToken = decrypt(userToken, keyHex);

      AppCivistNonce.addNonce({nonce: decryptedToken.nonce});
      const {username} = decryptedToken;

      check({username}, {
        username: Match.RegexString(User.VALID_USERNAME),
      });
      // Does user already exists? Then we just sign the user in.
      const user = Accounts.findUserByUsername(username);
      if (user) {
        return {userId: user._id};
      }

      // Otherwise we create a new user.
      const userId = Accounts.createUser({username});

      // Safety belt. createUser is supposed to throw on error.
      if (!userId) {
        throw new Error("Failed to insert a new user.");
      }

      // Client gets logged in as the new user afterwards.
      return {userId};
    });
  },
});
