import {Meteor} from 'meteor/meteor';
import {_} from 'meteor/underscore';

import {BaseDocument} from '../base';

export class AppCivistNonce extends BaseDocument {
  // createdAt: time of document creation
  // nonce: Nonce obtained from the user token

  static REFERENCE_FIELDS() {
    return {
      _id: 1,
    };
  }

  static PUBLISH_FIELDS() {
    return _.extend(super.PUBLISH_FIELDS(), {
      _id: 1,
      createdAt: 1,
      nonce: 1,
    });
  }

  getReference() {
    return _.pick(this, Object.keys(this.constructor.REFERENCE_FIELDS()));
  }
}

// Server-side only method, so we are not using ValidatedMethod.
// Can be called without a callback on the server, but callback should be
// provided on the client if return value is wanted.
AppCivistNonce.addNonce = function upsert(...args) {
  args.unshift('AppCivistNonce.addNonce');
  return Meteor.call(...args);
};

AppCivistNonce.Meta({
  name: 'appcivist.nonce',
});

if (Meteor.isServer) {
  AppCivistNonce.Meta.collection._ensureIndex({
    nonce: 1,
  }, {
    unique: true,
  });
}
