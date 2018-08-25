// This is a server-only collection. So we do not use Meteor methods at all.

import {check, Match} from 'meteor/check';
import {Meteor} from 'meteor/meteor';

import {BaseDocument} from '/lib/base';

export class Nonce extends BaseDocument {
  // nonce: unique nonce to be stored
}

Nonce.addNonce = function addNonce(args) {
  check(args, {
    nonce: Match.NonEmptyString,
  });

  return Nonce.documents.insert({
    nonce: args.nonce,
  });
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
