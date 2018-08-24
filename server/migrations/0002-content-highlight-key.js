import {Content} from '/lib/documents/content';

class Migration extends Document.MajorMigration {
  name = "Changing highlight-keys field to content-key";

  forward(documentClass, collection, currentSchema, newSchema) {
    let count = 0;

    collection.findEach({_schema: currentSchema, 'step.mark.type': 'highlight'}, {step: 1}, (document) => {
      const updateQuery = {
        $set: {
          _schema: newSchema,
          'step.mark.attrs.highlight-key': document.step.mark.attrs['highlight-keys'],
        },
        $unset: {
          'step.mark.attrs.highlight-keys': '',
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

    collection.findEach({_schema: currentSchema, 'step.mark.type': 'highlight'}, {step: 1}, (document) => {
      const updateQuery = {
        $set: {
          _schema: oldSchema,
          'step.mark.attrs.highlight-keys': document.step.mark.attrs['highlight-key'],
        },
        $unset: {
          'step.mark.attrs.highlight-key': '',
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
