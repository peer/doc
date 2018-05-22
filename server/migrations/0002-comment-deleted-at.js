import {Comment} from '/lib/documents/comment';

class Migration extends Document.AddRequiredFieldsMigration {
  name = "Adding deletedAt field"
  fields = {
    deletedAt: null,
  }
}

Comment.addMigration(new Migration());
