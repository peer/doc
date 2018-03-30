import {Meteor} from 'meteor/meteor';

import {BaseDocument} from '../base';

export class Nonce extends BaseDocument {
  // nonce: unique nonce to be stored
}

// Server-side only method, so we are not using ValidatedMethod.
// Can be called without a callback on the server, but callback should be
// provided on the client if return value is wanted.
Nonce.addNonce = function upsert(...args) {
  args.unshift('Nonce.addNonce');
  return Meteor.call(...args);
};

Nonce.Meta({
  name: 'Nonce',
});

if (Meteor.isServer) {
  Nonce.Meta.collection._ensureIndex({
    nonce: 1,
  }, {
    unique: true,
  });
}
