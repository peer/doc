import {Accounts} from 'meteor/accounts-base';
import {Meteor} from 'meteor/meteor';

import {User} from '/lib/documents/user';

if (!Meteor.settings.public.passwordlessAuthDisabled) {
  User.passwordlessSignIn = function passwordlessSignIn({username}, callback) {
    Accounts.callLoginMethod({
      methodName: 'User.passwordlessSignIn',
      methodArguments: [{username}],
      userCallback(error, userId) {
        if (error) {
          callback(error);
        }
        else {
          callback(null, {_id: userId});
        }
      },
    });
  };
}
