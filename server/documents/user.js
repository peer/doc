import {Accounts} from 'meteor/accounts-base';
import {Meteor} from 'meteor/meteor';
import {Match} from 'meteor/check';

import {User} from '/lib/documents/user';
import {check} from '/server/check';

Accounts.onCreateUser(function onCreateUser(options, user) {
  // We ignore options.profile because we do not use profile.

  if (options.avatar) {
    user.avatar = options.avatar; // eslint-disable-line no-param-reassign
  }

  return user;
});

Meteor.methods({
  // TODO: Make into a publish endpoint, so that we update the list reactively.
  // TODO: Restrict who can query (maybe just logged in users) and how many results.
  'User.findByUsername'(args) {
    check(args, {
      username: Match.NonEmptyString,
    });

    const users = User.documents.find(
      {
        // TODO: Check that given "username" is just string and not regex.
        username: {$regex: args.username},
      },
      {
        fields: User.REFERENCE_FIELDS(),
      },
    ).fetch();

    return users;
  },
});

// Some User fields are published automatically for the current user,
// here we publish extra fields we need for the current user on the client.
Meteor.publish(null, function userPublish() {
  return User.documents.find({
    _id: Meteor.userId(),
  }, {
    fields: User.EXTRA_PUBLISH_FIELDS(),
  });
});
