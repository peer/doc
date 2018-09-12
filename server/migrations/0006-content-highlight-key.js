import {_} from 'meteor/underscore';

import {Content} from '/lib/documents/content';

// We modified ProseMirror schema so we have to update data for it.

export function toHighlightKey(obj) {
  if (_.isArray(obj)) {
    return _.map(obj, toHighlightKey);
  }
  else if (_.isObject(obj)) {
    const result = _.clone(obj);
    if (_.has(result, 'highlight-keys')) {
      // We use only the first highlight key and not all. This is not ideal, but it simplifies migration.
      result['highlight-key'] = result['highlight-keys'].split(',')[0];
      delete result['highlight-keys'];
    }
    _.each(result, (value, key) => {
      result[key] = toHighlightKey(value);
    });
    return result;
  }
  else {
    return obj;
  }
}

export function toHighlightKeys(obj) {
  if (_.isArray(obj)) {
    return _.map(obj, toHighlightKeys);
  }
  else if (_.isObject(obj)) {
    const result = _.clone(obj);
    if (_.has(obj, 'highlight-key')) {
      result['highlight-keys'] = result['highlight-key'];
      delete result['highlight-key'];
    }
    _.each(result, (value, key) => {
      result[key] = toHighlightKeys(value);
    });
    return result;
  }
  else {
    return obj;
  }
}

class Migration extends Document.MajorMigration {
  name = "Changing highlight-keys ProseMirror attribute to highlight-key";

  forward(documentClass, collection, currentSchema, newSchema) {
    let count = 0;

    collection.findEach({_schema: currentSchema}, {_id: 1, step: 1}, (document) => {
      const updateQuery = {
        $set: {
          _schema: newSchema,
          step: toHighlightKey(document.step),
        },
      };

      count += collection.update({_schema: currentSchema, _id: document._id}, updateQuery);
    });

    const counts = super.forward(documentClass, collection, currentSchema, newSchema);
    counts.migrated += count;
    counts.all += count;
    return counts;
  }

  backward(documentClass, collection, currentSchema, oldSchema) {
    let count = 0;

    collection.findEach({_schema: currentSchema}, {_id: 1, step: 1}, (document) => {
      const updateQuery = {
        $set: {
          _schema: oldSchema,
          step: toHighlightKeys(document.step),
        },
      };

      count += collection.update({_schema: currentSchema, _id: document._id}, updateQuery);
    });

    const counts = super.forward(documentClass, collection, currentSchema, oldSchema);
    counts.migrated += count;
    counts.all += count;
    return counts;
  }
}

Content.addMigration(new Migration());
