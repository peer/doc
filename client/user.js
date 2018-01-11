import {Accounts} from 'meteor/accounts-base';

import {User} from '/lib/user';

// A special case which is not using ValidatedMethod because client side
// differs a lot from the server side and there is no client stub.
User.createUserAndSignIn = function createUserAndSignIn({username}, callback) {
  Accounts.callLoginMethod({
    methodName: 'User.createUserAndSignIn',
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
