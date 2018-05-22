import {Comment} from '/lib/documents/comment';

class Migration extends Document.AddRequiredFieldsMigration {
  name = "Adding status field"
  fields = {
    status: Comment.STATUS.CREATED,
  }
}

Comment.addMigration(new Migration());
