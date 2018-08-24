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
        // eslint-disable-next-line no-console
        console.error("Error calling 'User.createUserAndSignInWithUserToken' method.", error);
      }
    },
  });
}

const parsedQueryString = queryString.parse(window.location.search);

if (parsedQueryString.user) {
  signinWithUserToken(parsedQueryString.user);
}
