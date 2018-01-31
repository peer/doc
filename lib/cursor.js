import {Meteor} from 'meteor/meteor';
import {_} from 'meteor/underscore';


import {BaseDocument} from './base';
import {User} from './user';

export class Cursor extends BaseDocument {
  static REFERENCE_FIELDS() {
    return {
      _id: 1,
    };
  }

  static PUBLISH_FIELDS() {
    return _.extend(super.PUBLISH_FIELDS(), {
      _id: 1,
      createdAt: 1,
      from: 1,
      to: 1,
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

Cursor.update = function upsert(...args) {
  args.unshift('Cursor.update');
  return Meteor.call(...args);
};

Cursor.remove = function remove(...args) {
  args.unshift('Cursor.remove');
  return Meteor.call(...args);
};

if (Meteor.isServer) {
  Cursor.Meta.collection._ensureIndex({
    contentKey: 1,
    clientId: -1,
  }, {
    unique: true,
  });

  Cursor.Meta.collection._ensureIndex({
    contentKey: 1,
  });
}
