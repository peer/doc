import {Accounts} from 'meteor/accounts-base';
import {Meteor} from 'meteor/meteor';
import {_} from 'meteor/underscore';

import queryString from 'query-string';

function signinWithUserToken(userToken) {
  Accounts.callLoginMethod({
    methodName: 'User.createUserAndSignInWithUserToken',
    methodArguments: [{userToken}],
    // We do not notify user about being the process here,
    // this should all happen in the background.
    userCallback(error, loginDetails) {
      if (error) {
        // eslint-disable-next-line no-console
        console.error("Error calling 'User.createUserAndSignInWithUserToken' method.", error);
      }
    },
  });
}

const parsedQueryString = queryString.parse(window.location.search);

if (_.has(parsedQueryString, 'user')) {
  if (parsedQueryString.user) {
    signinWithUserToken(parsedQueryString.user);
  }
  else {
    Meteor.logout();
  }
}
