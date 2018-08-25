import {Comment} from '/lib/documents/comment';

class Migration extends Document.AddRequiredFieldsMigration {
  name = "Adding status, deletedAt, deletedBy fields";
  fields = {
    status: Comment.STATUS.CREATED,
    deletedAt: null,
    deletedBy: null,
  };
}

Comment.addMigration(new Migration());
