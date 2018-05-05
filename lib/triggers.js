import {_} from 'meteor/underscore';

import {BaseDocument} from './base';

// Updates the lastActivity field when any of provided fields of a document change.
class LastActivityTriggerClass extends BaseDocument._Trigger {
  updateLastActivity(id, timestamp) {
    this.document.documents.update({
      _id: id,
      $or: [{
        lastActivity: {
          $lt: timestamp,
        },
      }, {
        lastActivity: null,
      }],
    }, {
      $set: {
        lastActivity: timestamp,
      },
    });
  }

  constructor(fields, trigger) {
    const defaultTrigger = (newDocument, oldDocument) => {
      // Don't do anything when document is removed.
      if (!newDocument || !newDocument._id) {
        return;
      }

      // Don't do anything if there was no change.
      if (_.isEqual(newDocument, oldDocument)) {
        return;
      }

      const timestamp = new Date();
      this.updateLastActivity(newDocument._id, timestamp);
    };

    super(fields, trigger || defaultTrigger);
  }
}

export const LastActivityTrigger = (...args) => {
  return new LastActivityTriggerClass(...args);
};

// Updates the lastActivity field of a related document when
// any of provided fields of a document change.
class RelatedLastActivityTriggerClass extends BaseDocument._Trigger {
  updateLastActivity(id, timestamp) {
    this.relatedDocument.documents.update({
      _id: id,
      $or: [{
        lastActivity: {
          $lt: timestamp,
        },
      }, {
        lastActivity: null,
      }],
    }, {
      $set: {
        lastActivity: timestamp,
      },
    });
  }

  constructor(relatedDocument, fields, relatedIds) {
    const trigger = (newDocument, oldDocument) => {
      // Don't do anything when document is removed.
      if (!newDocument || !newDocument._id) {
        return;
      }

      // Don't do anything if there was no change.
      if (_.isEqual(newDocument, oldDocument)) {
        return;
      }

      const timestamp = new Date();

      let ids = this.relatedIds(newDocument, oldDocument);
      if (!_.isArray(ids)) {
        ids = [ids];
      }

      for (const relatedId of ids) {
        if (!relatedId) {
          continue;
        }

        this.updateLastActivity(relatedId, timestamp);
      }
    };

    super(fields, trigger);

    this.relatedDocument = relatedDocument;
    this.relatedIds = relatedIds;
  }
}

export const RelatedLastActivityTrigger = (...args) => {
  return new RelatedLastActivityTriggerClass(...args);
};

// When any content fields (provided fields) of a document
// change we update both updatedAt and lastActivity fields.
class UpdatedAtTriggerClass extends LastActivityTriggerClass {
  updateUpdatedAt(id, timestamp) {
    this.document.documents.update({
      _id: id,
      $or: [{
        updatedAt: {
          $lt: timestamp,
        },
      }, {
        updatedAt: null,
      }],
    }, {
      $set: {
        updatedAt: timestamp,
      },
    });
  }

  constructor(fields, noLastActivity) {
    const trigger = (newDocument, oldDocument) => {
      // Don't do anything when document is removed.
      if (!newDocument || !newDocument._id) {
        return;
      }

      // Don't do anything if there was no change.
      if (_.isEqual(newDocument, oldDocument)) {
        return;
      }

      const timestamp = new Date();

      this.updateUpdatedAt(newDocument._id, timestamp);

      // Every time we update updatedAt, we update lastActivity as well.
      if (!noLastActivity) {
        this.updateLastActivity(newDocument._id, timestamp);
      }
    };

    super(fields, trigger);
  }
}

export const UpdatedAtTrigger = (...args) => {
  return new UpdatedAtTriggerClass(...args);
};
