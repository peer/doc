import {Document as DocumentCollection} from '/lib/documents/document';

class Migration extends Document.MinorMigration {
  name = "Adding document admin permissions to authors";
  forward = (document, collection, currentSchema, newSchema) => {
    let count = 0;

    collection.findEach({_schema: currentSchema, userPermissions: {$exists: false}, visibility: {$exists: false}}, {_schema: 1, author: 1, createdAt: 1}, (doc) => {
      const userPermissions = DocumentCollection.getUserPermissions(DocumentCollection.ROLES.ADMIN, doc.author, doc.createdAt, doc.author);
      count += collection.update(doc, {
        $set: {
          visibility: DocumentCollection.VISIBILITY_LEVELS.PRIVATE,
          userPermissions,
          _schema: newSchema,
        },
      });
      return count;
    });

    const counts = super.forward(document, collection, currentSchema, newSchema);
    counts.migrated += count;
    counts.all += count;
    return counts;
  }

  backward = (document, collection, currentSchema, oldSchema) => {
    let count = 0;

    count = collection.update(
      {_schema: currentSchema}
    , {
      $set: {
        _schema: oldSchema,
      },
      $unset: {
        visibility: '',
        userPermissions: '',
      },
    }
    ,
      {multi: true},
    );

    const counts = super.backward(document, collection, currentSchema, oldSchema);
    counts.migrated += count;
    counts.all += count;
    return counts;
  }
}
DocumentCollection.addMigration(new Migration());
