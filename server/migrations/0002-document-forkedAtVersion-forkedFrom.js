import {Document} from '/lib/documents/comment';

class Migration extends Document.AddRequiredFieldsMigration {
  name = "Adding forkedAtVersion and forkedFrom fields"
  fields = {
    forkedAtVersion: null,
    forkedFrom: null,
  }
}

Document.addMigration(new Migration());
