import {Accounts} from 'meteor/accounts-base';
import {Meteor} from 'meteor/meteor';
import {check} from 'meteor/check';

import {User} from '/lib/documents/user';

Accounts.onCreateUser(function onCreateUser(options, user) {
  // We ignore options.profile because we do not use profile.

  if (options.avatar) {
    user.avatar = options.avatar; // eslint-disable-line no-param-reassign
  }

  return user;
});

Meteor.methods({
  // TODO: Make into a publish endpoint. With avatars.
  'User.findByUsername'(args) {
    check(args, {
      username: String,
    });

    const user = User.documents.find(
      {
        username: {$regex: `^${args.username}`},
      },
      {
        fields: {
          username: 1,
          avatar: 1,
        },
      },
    ).fetch();

    return user;
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

// For testing.
export {User};
