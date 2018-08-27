import {Content} from '/server/documents/content';

// We modified ProseMirror schema so we have to update data for it.

class Migration extends Document.MajorMigration {
  name = "Changing highlight-keys ProseMirror attribute to highlight-key";

  forward(documentClass, collection, currentSchema, newSchema) {
    let count = 0;

    collection.findEach({_schema: currentSchema, 'step.mark.type': 'highlight'}, {_id: 1}, (document) => {
      const updateQuery = {
        $set: {
          _schema: newSchema,
        },
        $rename: {
          'step.mark.attrs.highlight-keys': 'step.mark.attrs.highlight-key',
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

    collection.findEach({_schema: currentSchema, 'step.mark.type': 'highlight'}, {_id: 1}, (document) => {
      const updateQuery = {
        $set: {
          _schema: oldSchema,
        },
        $rename: {
          'step.mark.attrs.highlight-keys': 'step.mark.attrs.highlight-key',
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
