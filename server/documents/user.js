import {Accounts} from 'meteor/accounts-base';
import {check, Match} from 'meteor/check';
import {Meteor} from 'meteor/meteor';

import {User} from '/lib/documents/user';

Accounts.onCreateUser(function onCreateUser(options, user) {
  // We simply ignore options.profile because we do not use profile.
  return user;
});

// A special case which is not using ValidatedMethod because client side
// differs a lot from the server side and there is no client stub.
Meteor.methods({
  'User.createUserAndSignIn'(...allArgs) {
    const args = allArgs[0];

    return Accounts._loginMethod(this, 'User.createUserAndSignIn', allArgs, 'passwordless', () => {
      check(args, {
        username: Match.RegexString(User.VALID_USERNAME),
      });
      if (Accounts._options.forbidClientAccountCreation) {
        return {
          error: new Meteor.Error('forbidden', "Sign ups forbidden."),
        };
      }

      const {username} = args;

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

// Some User fields are published automatically for the current user,
// here we publish extra fields we need for the current user on the client.
Meteor.publish(null, function userPublish() {
  return User.documents.find({
    _id: Meteor.userId(),
  }, {
    fields: User.EXTRA_PUBLISH_FIELDS(),
  });
});

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
