import {Meteor} from 'meteor/meteor';

import {User} from '/lib/documents/user';
import {callLoginMethodAsync} from '/lib/utils';

if (!Meteor.settings.public.passwordlessAuthDisabled) {
  User.passwordlessSignIn = function passwordlessSignIn({username}, callback) {
    return callLoginMethodAsync('User.passwordlessSignIn', [{username}], callback);
  };
}
