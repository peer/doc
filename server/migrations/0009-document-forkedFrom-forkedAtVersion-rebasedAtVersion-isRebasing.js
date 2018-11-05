import {Document} from '/lib/documents/document';

class Migration extends Document.AddRequiredFieldsMigration {
  name = "Adding forkedFrom, forkedAtVersion, rebasedAtVersion, and isRebasing fields";
  fields = {
    forkedFrom: null,
    forkedAtVersion: null,
    rebasedAtVersion: null,
    isRebasing: false,
  }
}

Document.addMigration(new Migration());
