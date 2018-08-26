import {Meteor} from 'meteor/meteor';
import {_} from 'meteor/underscore';

import {BaseDocument} from '../base';
import {User} from './user';
import {Comment} from './comment';
import {Document} from './document';

export class Activity extends BaseDocument {
  // _id: ID of the document
  // timestamp: time of activity
  // connection
  // byUser:
  //   _id
  //   username
  //   avatar
  // forUsers: list of:
  //   _id
  //   username
  //   avatar
  // type: type of activity
  // level: one of Activity.LEVEL values
  // data: custom data for this activity

  static PUBLISH_FIELDS() {
    let forUsers;
    const userId = Meteor.userId();

    if (userId) {
      forUsers = {
        forUsers: {
          // We can use "$elemMatch" here in the projection instead of a middleware
          // because there is only one item in "forUsers" we want to keep.
          $elemMatch: {
            _id: userId,
          },
        },
      };
    }
    else {
      forUsers = {};
    }

    return _.extend(super.PUBLISH_FIELDS(), forUsers, {
      timestamp: 1,
      byUser: 1,
      type: 1,
      level: 1,
      data: 1,
    });
  }
}

Activity.Meta({
  name: 'Activity',
  collection: 'Activities',
  fields(fields) {
    return _.extend(fields, {
      byUser: Activity.ReferenceField(User, User.REFERENCE_FIELDS(), false),
      forUsers: [
        Activity.ReferenceField(User, User.REFERENCE_FIELDS()),
      ],
      data: {
        comment: Activity.ReferenceField(Comment, [], false),
        document: Activity.ReferenceField(Document, ['title'], false),
      },
    });
  },
});

Activity.LEVEL = {
  DEBUG: 'debug',
  ERROR: 'error',
  ADMIN: 'admin',
  USER: 'user',
  GENERAL: 'general',
};

if (Meteor.isServer) {
  Activity.Meta.collection._ensureIndex({
    timestamp: 1,
  });

  Activity.Meta.collection._ensureIndex({
    type: 1,
  });
}
