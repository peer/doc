import {Accounts} from 'meteor/accounts-base';
import {MethodHooks} from 'meteor/doctorpangloss:method-hooks';

Accounts.onCreateUser(function (options, user) {
  // We simply ignore options.profile because we do not use profile.
  return user;
});

// We disable all service configurations from the client. We do not use this feature.
// See: https://github.com/meteor/meteor/issues/7745
MethodHooks.before('configureLoginService', function (options) {
  throw new Meteor.Error('invalid-request', "Disabled.");
});
