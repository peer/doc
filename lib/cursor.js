import {Meteor} from 'meteor/meteor';
import {_} from 'meteor/underscore';

import {BaseDocument} from './base';
import {User} from './user';

export class Cursor extends BaseDocument {
  // createdAt: time of document creation
  // author:
  //   _id
  //   username
  //   avatar
  // contentKey: ID used to identify editor's content
  // connectionId: ID of the connection associated with the user
  // clientId: ID of the client this cursor belongs to
  // color: Generated hex color to show to use for this user
  // ranges: Array of selection ranges made by the user
  // head: Position of the document where the cursor is now placed

  static REFERENCE_FIELDS() {
    return {
      _id: 1,
    };
  }

  static PUBLISH_FIELDS() {
    return _.extend(super.PUBLISH_FIELDS(), {
      _id: 1,
      createdAt: 1,
      head: 1,
      ranges: 1,
      author: 1,
      contentKey: 1,
      color: 1,
      clientId: 1,
    });
  }

  getReference() {
    return _.pick(this, Object.keys(this.constructor.REFERENCE_FIELDS()));
  }
}

Cursor.Meta({
  name: 'Cursor',
  fields(fields) {
    return _.extend(fields, {
      author: Cursor.ReferenceField(User, User.REFERENCE_FIELDS()),
    });
  },
});

// Server-side only method, so we are not using ValidatedMethod.
// Can be called without a callback on the server, but callback should be
// provided on the client if return value is wanted.
Cursor.update = function upsert(...args) {
  args.unshift('Cursor.update');
  return Meteor.call(...args);
};

if (Meteor.isServer) {
  Cursor.Meta.collection._ensureIndex({
    contentKey: 1,
    clientId: 1,
    connectionId: 1,
  }, {
    unique: true,
  });

  Cursor.Meta.collection._ensureIndex({
    contentKey: 1,
  });

  Cursor.Meta.collection._ensureIndex({
    connectionId: 1,
  });
}
