import {Accounts} from 'meteor/accounts-base';

import {ValidatedMethod} from 'meteor/mdg:validated-method';

import {User} from '/lib/user';

// A special case which is not using ValidatedMethod because client side
// differs a lot from the server side and there is no client stub.
User.createUserAndSignIn = function ({username}, callback) {
  Accounts.callLoginMethod({
    methodName: 'User.createUserAndSignIn',
    methodArguments: [{username}],
    userCallback: function (error, userId) {
      if (error) {
        callback(error);
      }
      else {
        callback(null, {_id: userId});
      }
    }
  });
};
