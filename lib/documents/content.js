import {Meteor} from 'meteor/meteor';
import {_} from 'meteor/underscore';

import {User} from './user';
import {BaseDocument} from '../base';

export class Content extends BaseDocument {
  // _id: ID of the document
  // createdAt: time of document creation
  // author:
  //   _id
  //   username
  //   avatar
  // contentKey: ID used to identify editor's content
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
      clientId: 1,
      version: 1,
      step: 1,
    });
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

// Server-side only method, so we are not using ValidatedMethod.
// Can be called without a callback on the server, but callback should be
// provided on the client if return value is wanted.
Content.addSteps = function addSteps(...args) {
  args.unshift('Content.addSteps');
  return Meteor.call(...args);
};

if (Meteor.isServer) {
  Content.Meta.collection._ensureIndex({
    contentKey: 1,
    version: -1,
  }, {
    unique: true,
  });

  Content.Meta.collection._ensureIndex({
    contentKey: 1,
  });
}
