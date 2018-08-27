import {Comment} from '/server/documents/comment';

// This migration is a data migration and not schema migration.
// We are updating documents, not really changing a schema.

class Migration extends Document.PatchMigration {
  name = "Adding comment permissions for authors";

  forward(documentClass, collection, currentSchema, newSchema) {
    let count = 0;

    collection.findEach({_schema: currentSchema}, {author: 1, createdAt: 1}, (document) => {
      // Author might not exist anymore.
      if (!document.author) {
        return;
      }

      const userPermissions = [
        {
          user: document.author,
          addedAt: document.createdAt,
          addedBy: document.author,
          permission: Comment.PERMISSIONS.VIEW,
        },
        {
          user: document.author,
          addedAt: document.createdAt,
          addedBy: document.author,
          permission: Comment.PERMISSIONS.DELETE,
        },
      ];

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

Comment.addMigration(new Migration());
