import {_} from 'meteor/underscore';

import {Content} from '/lib/documents/content';
import {Document} from "/lib/documents/document";

// This migration is a data migration and not schema migration.
// We are updating documents, not really changing a schema.

function getContributors(contentKey, documentAuthor) {
  let contributors = _.uniq(Content.documents.find({contentKey}, {
    fields: {author: 1},
  }).map((x) => {
    return x.author;
  }).filter((x) => {
    // Contributor might be not exist anymore.
    return !!x;
  }), (author) => {
    return author._id;
  });

  if (documentAuthor) {
    contributors = contributors.filter((x) => {
      return x._id !== documentAuthor._id;
    });
  }

  return contributors;
}

class Migration extends Document.PatchMigration {
  name = "Adding document permissions for contributors";

  forward(documentClass, collection, currentSchema, newSchema) {
    let count = 0;

    collection.findEach({_schema: currentSchema}, {author: 1, createdAt: 1, contentKey: 1}, (document) => {
      const contributors = getContributors(document.contentKey, document.author);

      let changed = 0;

      contributors.forEach((contributor) => {
        const userPermissions = Document.getPermissionObjects(
          Document.getRolePermissions(Document.ROLES.EDIT),
          contributor,
          document.createdAt,
          document.author,
        );

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

    collection.findEach({_schema: currentSchema}, {author: 1, contentKey: 1}, (document) => {
      const contributorIds = getContributors(document.contentKey, document.author).map((contributor) => {
        return contributor._id;
      });

      count += collection.update({
        _id: document._id,
        _schema: currentSchema,
        userPermissions: {
          'user._id': {
            $in: contributorIds,
          },
        },
      }, {
        $set: {
          _schema: oldSchema,
        },
        $pull: {
          userPermissions: {
            'user._id': {
              $in: contributorIds,
            },
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
