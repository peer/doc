import {Accounts} from 'meteor/accounts-base';

import {User} from '/lib/documents/user';

// A special case which is not using ValidatedMethod because client side
// differs a lot from the server side and there is no client stub.
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
