import {Document} from '/lib/documents/document';

// This migration is a data migration and not schema migration.
// We are updating documents, not really changing a schema.

class Migration extends Document.PatchMigration {
  name = "Adding document permissions for authors";

  forward(documentClass, collection, currentSchema, newSchema) {
    let count = 0;

    collection.findEach({_schema: currentSchema}, {author: 1, createdAt: 1}, (document) => {
      // Author might not exist anymore.
      if (!document.author) {
        return;
      }

      const userPermissions = Document.getPermissionObjects(
        Document.getRolePermissions(Document.ROLES.ADMIN),
        document.author,
        document.createdAt,
        document.author,
      );

      let changed = 0;

      userPermissions.forEach((userPermission) => {
        changed += collection.update({
          _id: document._id,
          _schema: currentSchema,
          userPermissions: {
            $not: {
              $elemMatch: {
                'user._id': userPermission.user._id,
                permission: userPermission.permission,
              },
            },
          },
        }, {
          $addToSet: {
            userPermissions: userPermission,
          },
        });
      });

      if (changed) {
        count += collection.update({
          _id: document._id,
          _schema: currentSchema,
        }, {
          $set: {
            _schema: newSchema,
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
    let count = 0;

    collection.findEach({_schema: currentSchema}, {author: 1}, (document) => {
      // Author might not exist anymore.
      if (!document.author) {
        return;
      }

      count += collection.update({
        _id: document._id,
        _schema: currentSchema,
        userPermissions: {
          'user._id': document.author._id,
        },
      }, {
        $set: {
          _schema: oldSchema,
        },
        $pull: {
          userPermissions: {
            'user._id': document.author._id,
          },
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
