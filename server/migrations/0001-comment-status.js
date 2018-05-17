import {Comment} from '/lib/documents/comment';

class Migration extends Document.AddRequiredFieldsMigration {
  constructor() {
    super();
    this.name = "Adding status field";
    this.fields =
    {status: ''};
  }
}

Comment.addMigration(new Migration());
