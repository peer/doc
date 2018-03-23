import {check} from 'meteor/check';
import {Meteor} from 'meteor/meteor';

import {AppCivistNonce} from '/lib/documents/appcivist-nonce';

// Server-side only method, so we are not using ValidatedMethod.
Meteor.methods({
  'AppCivistNonce.addNonce'(args) {
    check(args, {
      nonce: String,
    });

    return AppCivistNonce.documents.insert({
      nonce: args.nonce,
    });
  },
});
