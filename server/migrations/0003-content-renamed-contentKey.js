import {Content} from '/lib/documents/content';

class Migration extends Document.MajorMigration {
  name = "Changing contentKey field to contentKeys";

  // Transforms contentKey field to an array and renames it to contentKeys
  forward(documentClass, collection, currentSchema, newSchema) {
    let count = 0;

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

  // Transforms contentKeys array to a string field and renames it to contentKey.
  // If there was more than one contentKey in the contentKeys array, a new content
  // document is created for each aditional contentKey.
  backward(documentClass, collection, currentSchema, oldSchema) {
    let count = 0;

    collection.findEach({_schema: currentSchema, contentKeys: {$exists: true}}, {contentKeys: 1}, (document) => {
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
        document.contentKeys.forEach((x, i) => {
          if (i > 0) {
            collection.insert({
              createdAt: document.createdAt,
              contentKey: x,
              author: document.author,
              clientId: document.clientId,
              version: document.version,
              step: document.step,
              _schema: oldSchema,
            });
          }
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
