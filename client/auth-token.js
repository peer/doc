import {Meteor} from 'meteor/meteor';
import {_} from 'meteor/underscore';

import queryString from 'query-string';

import {User} from '/lib/documents/user';
import {callLoginMethodAsync} from '/lib/utils';

User.userTokenSignIn = function userTokenSignIn({userToken}, callback) {
  return callLoginMethodAsync('User.createUserAndSignInWithUserToken', [{userToken}], callback);
};

const parsedQueryString = queryString.parse(window.location.search);

if (_.has(parsedQueryString, 'user')) {
  if (parsedQueryString.user) {
    // We do not notify user about being the process here,
    // this should all happen in the background.
    User.userTokenSignIn({userToken: parsedQueryString.user}, (error) => {
      // eslint-disable-next-line no-console
      console.error("Error calling 'User.createUserAndSignInWithUserToken' method.", error);
    });
  }
  else {
    Meteor.logout();
  }
}
