import {Document} from '/lib/documents/document';

// This migration is a data migration and not schema migration.
// We are updating documents, not really changing a schema.

class Migration extends Document.PatchMigration {
  name = "Adding PUBLISH and ACCEPT_MERGE document permissions";

  forward(documentClass, collection, currentSchema, newSchema) {
    let count = 0;

    collection.findEach({_schema: currentSchema}, {userPermissions: 1}, (document) => {
      let changed = 0;

      document.userPermissions.forEach((userPermission) => {
        if (userPermission.permission !== Document.PERMISSIONS.ADMIN) {
          return;
        }

        for (const permission of [Document.PERMISSIONS.PUBLISH, Document.PERMISSIONS.ACCEPT_MERGE]) {
          const newUserPermission = Object.assign({}, userPermission, {
            permission,
          });

          changed += collection.update({
            _id: document._id,
            _schema: currentSchema,
            userPermissions: {
              $not: {
                $elemMatch: {
                  'user._id': newUserPermission.user._id,
                  permission: newUserPermission.permission,
                },
              },
            },
          }, {
            $addToSet: {
              userPermissions: newUserPermission,
            },
          });
        }
      });

      changed += collection.update({
        _id: document._id,
        defaultPermissions: Document.PERMISSIONS.ADMIN,
      }, {
        $addToSet: {
          defaultPermissions: {$each: [Document.PERMISSIONS.PUBLISH, Document.PERMISSIONS.ACCEPT_MERGE]},
        },
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
    const count = collection.update({
      _schema: currentSchema,
      $or: [{
        userPermissions: {
          permission: {$in: [Document.PERMISSIONS.PUBLISH, Document.PERMISSIONS.ACCEPT_MERGE]},
        },
      }, {
        defaultPermissions: {$in: [Document.PERMISSIONS.PUBLISH, Document.PERMISSIONS.ACCEPT_MERGE]},
      }],
    }, {
      $set: {
        _schema: oldSchema,
      },
      $pull: {
        userPermissions: {
          permission: {$in: [Document.PERMISSIONS.PUBLISH, Document.PERMISSIONS.ACCEPT_MERGE]},
        },
        defaultPermissions: {$in: [Document.PERMISSIONS.PUBLISH, Document.PERMISSIONS.ACCEPT_MERGE]},
      },
    }, {
      multi: true,
    });

    const counts = super.backward(documentClass, collection, currentSchema, oldSchema);
    counts.migrated += count;
    counts.all += count;
    return counts;
  }
}

Document.addMigration(new Migration());
