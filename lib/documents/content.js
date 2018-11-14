import {Meteor} from 'meteor/meteor';
import {_} from 'meteor/underscore';

import {User} from './user';
import {BaseDocument} from '../base';
import {callAsync} from '../utils';

export class Content extends BaseDocument {
  // _id: ID of the document
  // createdAt: time of document creation
  // author:
  //   _id
  //   username
  //   avatar
  // contentKeys: list of ID used to identify editor's content
  // clientId: ID of the client which made this step
  // version: serial number for the step
  // step: step made for this version

  static REFERENCE_FIELDS() {
    return {
      _id: 1,
    };
  }

  static PUBLISH_FIELDS() {
    return _.extend(super.PUBLISH_FIELDS(), {
      _id: 1,
      version: 1,
      step: 1,
    });
  }

  static addSteps(...args) {
    return callAsync('Content.addSteps', args);
  }
}

Content.Meta({
  name: 'Content',
  fields(fields) {
    return _.extend(fields, {
      author: Content.ReferenceField(User, User.REFERENCE_FIELDS(), false),
    });
  },
});

if (Meteor.isServer) {
  Content.Meta.collection._ensureIndex({
    contentKeys: 1,
    version: -1,
  }, {
    unique: true,
    // To allow migration to this index.
    partialFilterExpression: {
      contentKeys: {$exists: true},
      version: {$exists: true},
    },
  });

  Content.Meta.collection._ensureIndex({
    contentKeys: 1,
  });
}
