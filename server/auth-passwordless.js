import {Accounts} from 'meteor/accounts-base';
import {check, Match} from 'meteor/check';
import {Meteor} from 'meteor/meteor';

import {User} from '/lib/documents/user';

if (!Meteor.settings.public.passwordlessAuthDisabled) {
  // A special case which is not using ValidatedMethod because client side
  // differs a lot from the server side and there is no client stub.
  Meteor.methods({
    'User.passwordlessSignIn'(...allArgs) {
      const args = allArgs[0];

      return Accounts._loginMethod(this, 'User.passwordlessSignIn', allArgs, 'passwordless', () => {
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

        let hash = 0;
        for (let i = 0; i < username.length; i += 1) {
          hash += username.charCodeAt(i);
        }
        const type = hash % 2 === 0 ? 'men' : 'women';
        hash >>= 1; // eslint-disable-line no-bitwise

        // Otherwise we create a new user.
        const userId = Accounts.createUser({
          username,
          avatar: `https://randomuser.me/api/portraits/${type}/${hash % 100}.jpg`,
        });

        // Safety belt. createUser is supposed to throw on error.
        if (!userId) {
          throw new Error("Failed to insert a new user.");
        }

        // Client gets logged in as the new user afterwards.
        return {userId};
      });
    },
  });
}
