import {Content} from '/lib/documents/content';
import {Document} from '/lib/documents/document';

class Migration extends Document.MajorMigration {
  name = "Adding mergeAcceptedAtVersion field";

  forward(documentClass, collection, currentSchema, newSchema) {
    let count = 0;

    collection.findEach({_schema: currentSchema}, {mergeAcceptedAt: 1, contentKey: 1}, (document) => {
      if (document.mergeAcceptedAt) {
        // Find the latest version before the merge accepted timestamp.
        const version = Content.documents.findOne({
          contentKeys: document.contentKey,
          createdAt: {
            $lte: document.mergeAcceptedAt,
          },
        }, {
          sort: {
            version: -1,
          },
        }).version;

        count += collection.update({
          _schema: currentSchema,
          _id: document._id,
          mergeAcceptedAt: document.mergeAcceptedAt,

        }, {
          $set: {
            _schema: newSchema,
            mergeAcceptedAtVersion: version,
          },
        });
      }
      else {
        count += collection.update({
          _schema: currentSchema,
          _id: document._id,
          mergeAcceptedAt: null,

        }, {
          $set: {
            _schema: newSchema,
            mergeAcceptedAtVersion: null,
          },
        });
      }
    });

    const counts = super.forward(documentClass, collection, currentSchema, newSchema);
    counts.migrated += count;
    counts.all += count;
    return counts;
  }

  backward(documentClass, collection, currentSchema, oldSchema) {
    const count = collection.update({
      _schema: currentSchema,
    }, {
      $set: {
        _schema: oldSchema,
      },
      $unset: {
        mergeAcceptedAtVersion: '',
      },
    }, {multi: true});

    const counts = super.backward(documentClass, collection, currentSchema, oldSchema);
    counts.migrated += count;
    counts.all += count;
    return counts;
  }
}

Document.addMigration(new Migration());
