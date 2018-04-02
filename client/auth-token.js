import {Accounts} from 'meteor/accounts-base';

import queryString from 'query-string';

function signinWithUserToken(userToken) {
  Accounts.callLoginMethod({
    methodName: 'User.createUserAndSignInWithUserToken',
    methodArguments: [{userToken}],
    // We do not notify user about being the process here,
    // this should all happen in the background.
    userCallback(error, userId) {
      if (error) {
        console.error("Error calling 'User.createUserAndSignInWithUserToken' method.", error); // eslint-disable-line no-console
      }
    },
  });
}

const parsedQueryString = queryString.parse(window.location.search);

if (parsedQueryString.user) {
  signinWithUserToken(parsedQueryString.user);
}
