import {Comment} from '/lib/documents/comment';

class Migration extends Document.AddRequiredFieldsMigration {
  name = "Adding status and deletedAt fields";
  fields = {
    status: Comment.STATUS.CREATED,
    deletedAt: null,
  };
}

Comment.addMigration(new Migration());
