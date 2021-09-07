import {Meteor} from 'meteor/meteor';
import {_} from 'meteor/underscore';

import {User} from './user';
import {BaseDocument} from '../base';
import {callAsync} from '../utils';

export class Cursor extends BaseDocument {
  // _id: ID of the document
  // createdAt: time of document creation
  // updatedAt: time of the last change
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

  static update(...args) {
    return callAsync('Cursor.update', args);
  }

  static remove(...args) {
    return callAsync('Cursor.delete', args);
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

  Cursor.Meta.collection._ensureIndex({
    updatedAt: 1,
  });

  Cursor.Meta.collection._ensureIndex({
    connectionId: 1,
    updatedAt: 1,
  });
}
