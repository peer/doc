import {Content} from '/lib/documents/content';
import {Document} from '/lib/documents/document';

class Migration extends Document.MajorMigration {
  name = "Adding publishedAtVersion field";

  forward(documentClass, collection, currentSchema, newSchema) {
    let count = 0;

    collection.findEach({_schema: currentSchema}, {publishedAt: 1, contentKey: 1}, (document) => {
      if (document.publishedAt) {
        // Find the latest version before the published timestamp.
        const version = Content.documents.findOne({
          contentKeys: document.contentKey,
          createdAt: {
            $lte: document.publishedAt,
          },
        }, {
          sort: {
            version: -1,
          },
        }).version;

        count += collection.update({
          _schema: currentSchema,
          _id: document._id,
          publishedAt: document.publishedAt,

        }, {
          $set: {
            _schema: newSchema,
            publishedAtVersion: version,
          },
        });
      }
      else {
        count += collection.update({
          _schema: currentSchema,
          _id: document._id,
          publishedAt: null,

        }, {
          $set: {
            _schema: newSchema,
            publishedAtVersion: null,
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
        publishedAtVersion: '',
      },
    }, {multi: true});

    const counts = super.backward(documentClass, collection, currentSchema, oldSchema);
    counts.migrated += count;
    counts.all += count;
    return counts;
  }
}

Document.addMigration(new Migration());
