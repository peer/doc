import {Accounts} from 'meteor/accounts-base';
import {check, Match} from 'meteor/check';

import {MethodHooks} from 'meteor/doctorpangloss:method-hooks';
import {PublishEndpoint} from 'meteor/peerlibrary:middleware';

import {User} from '/lib/user';

Accounts.onCreateUser(function (options, user) {
  // We simply ignore options.profile because we do not use profile.
  return user;
});

// We disable all service configurations from the client. We do not use this feature.
// See: https://github.com/meteor/meteor/issues/7745
MethodHooks.before('configureLoginService', function (options) {
  throw new Meteor.Error('invalid-request', "Disabled.");
});

Meteor.methods({
  'User.createUserAndSignIn'(args) {
    return Accounts._loginMethod(this, 'User.createUserAndSignIn', arguments, 'passwordless', () => {
      check(args, {
        username: Match.RegexString(User.VALID_USERNAME)
      });
      if (Accounts._options.forbidClientAccountCreation) {
        return {
          error: new Meteor.Error(403, "Sign ups forbidden.")
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
  }
});

new PublishEndpoint(null, function () {
  return User.documents.find({
    _id: Meteor.userId()
  }, {
    fields: User.EXTRA_PUBLISH_FIELDS()
  });
});
