import {_} from 'meteor/underscore';

import {Content} from '/lib/documents/content';

class Migration extends Document.MajorMigration {
  name = "Changing contentKey to contentKeys field";

  // Transforms "contentKey" field to an array and renames it to "contentKeys".
  forward(documentClass, collection, currentSchema, newSchema) {
    let count = 0;

    try {
      collection.dropIndex({
        contentKey: 1,
        version: -1,
      });
    }
    catch (error) {
      // We ignore any error.
    }

    collection.findEach({_schema: currentSchema, contentKey: {$exists: true}}, {contentKey: 1}, (document) => {
      const updateQuery = {
        $set: {
          _schema: newSchema,
          contentKeys: [document.contentKey],
        },
        $unset: {
          contentKey: '',
        },
      };

      count += collection.update({_schema: currentSchema, _id: document._id}, updateQuery);
    });

    const counts = super.forward(documentClass, collection, currentSchema, newSchema);
    counts.migrated += count;
    counts.all += count;
    return counts;
  }

  // Transforms "contentKeys" array to a string field and renames it to "contentKey".
  // If there was more than one value in the "contentKeys" array, a new "Content"
  // document is created for each additional value.
  backward(documentClass, collection, currentSchema, oldSchema) {
    let count = 0;

    try {
      collection.dropIndex({
        contentKeys: 1,
        version: -1,
      });
    }
    catch (error) {
      // We ignore any error.
    }

    collection.findEach({_schema: currentSchema, contentKeys: {$exists: true}}, {}, (document) => {
      const updateQuery = {
        $set: {
          _schema: oldSchema,
          contentKey: document.contentKeys[0],
        },
        $unset: {
          contentKeys: '',
        },
      };

      count += collection.update({_schema: currentSchema, _id: document._id}, updateQuery);

      if (document.contentKeys.length > 1) {
        document.contentKeys.forEach((contentKey, i) => {
          if (i === 0) {
            return;
          }

          const newDocument = _.extend(_.omit(document, '_id', 'contentKeys'), {
            contentKey,
            _schema: oldSchema,
          });

          collection.insert(newDocument);
        });
      }
    });

    const counts = super.backward(documentClass, collection, currentSchema, oldSchema);
    counts.migrated += count;
    counts.all += count;
    return counts;
  }
}

Content.addMigration(new Migration());
