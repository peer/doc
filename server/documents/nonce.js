import {check} from 'meteor/check';
import {Meteor} from 'meteor/meteor';

import {Nonce} from '/lib/documents/nonce';

// Server-side only method, so we are not using ValidatedMethod.
Meteor.methods({
  'Nonce.addNonce'(args) {
    check(args, {
      nonce: String,
    });

    return Nonce.documents.insert({
      nonce: args.nonce,
    });
  },
});
