import {Comment} from '/server/documents/comment';

class Migration extends Document.AddRequiredFieldsMigration {
  name = "Adding userPermissions, status, deletedAt, deletedBy fields";
  fields = {
    userPermissions: [],
    status: Comment.STATUS.CREATED,
    deletedAt: null,
    deletedBy: null,
  };
}

Comment.addMigration(new Migration());
