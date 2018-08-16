import {Document} from '/lib/documents/document';

class Migration extends Document.AddRequiredFieldsMigration {
  name = "Adding forkedAtVersion and forkedFrom fields"
  fields = {
    forkedAtVersion: null,
    forkedFrom: null,
  }
}

Document.addMigration(new Migration());
