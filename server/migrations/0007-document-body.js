import {extractTitle} from '/lib/utils';
import {Content} from '/lib/documents/content';
import {Document} from '/lib/documents/document';

// This migration is a data migration and not schema migration.
// We are updating documents, not really changing a schema.

class Migration extends Document.PatchMigration {
  name = "Regenerating body field";

  forward(documentClass, collection, currentSchema, newSchema) {
    let count = 0;

    collection.findEach({_schema: currentSchema}, {contentKey: 1}, (document) => {
      const {doc, version} = Content.getCurrentState(document.contentKey);

      count += collection.update({_schema: currentSchema, _id: document._id}, {
        $set: {
          version,
          _schema: newSchema,
          body: doc.toJSON(),
          title: extractTitle(doc),
        },
      });
    });

    const counts = super.forward(documentClass, collection, currentSchema, newSchema);
    counts.migrated += count;
    counts.all += count;
    return counts;
  }

  backward(documentClass, collection, currentSchema, oldSchema) {
    let count = 0;

    collection.findEach({_schema: currentSchema}, {contentKey: 1}, (document) => {
      const {doc, version} = Content.getCurrentState(document.contentKey);

      count += collection.update({_schema: currentSchema, _id: document._id}, {
        $set: {
          version,
          _schema: oldSchema,
          body: doc.toJSON(),
          title: extractTitle(doc),
        },
      });
    });

    const counts = super.backward(documentClass, collection, currentSchema, oldSchema);
    counts.migrated += count;
    counts.all += count;
    return counts;
  }
}

Document.addMigration(new Migration());
