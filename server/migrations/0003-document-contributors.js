import {Document as DocumentCollection} from '/lib/documents/document';
import {Content} from '/lib/documents/content';
import {User} from '/lib/documents/user';
import {_} from 'meteor/underscore';

class Migration extends Document.MinorMigration {
  name = "Adding document edit permissions to contributors";
  forward = (document, collection, currentSchema, newSchema) => {
    let count = 0;

    collection.findEach({_schema: currentSchema}, {_schema: 1, author: 1, createdAt: 1, contentKey: 1, userPermissions: 1}, (doc) => {
      let contributors = _.uniq(Content.documents.find({contentKey: doc.contentKey}, {
        fields: {author: 1},
      }).map((x) => {
        return x.author._id;
      }));

      contributors = contributors.filter((x) => {
        return x !== doc.author._id;
      });

      let userPermissions = doc.userPermissions || [];
      contributors.forEach((c) => {
        const user = User.documents.findOne({_id: c}, {fields: User.REFERENCE_FIELDS()});
        userPermissions = userPermissions.concat(DocumentCollection.getUserPermissions(Document.ROLES.EDIT, user, doc.createdAt, doc.author));
      });
      count += collection.update(doc, {
        $set: {
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

    collection.findEach({_schema: currentSchema}, {_id: 1, _schema: 1, author: 1, userPermissions: 1}, (doc) => {
      const userPermissions = doc.userPermissions.filter((x) => {
        return x.user._id !== doc.author._id;
      });
      count += collection.update(
        {_id: doc._id}
      , {
        $set: {
          _schema: oldSchema,
          userPermissions,
        },
      },
      );
    });

    const counts = super.backward(document, collection, currentSchema, oldSchema);
    counts.migrated += count;
    counts.all += count;
    return counts;
  }
}
DocumentCollection.addMigration(new Migration());
