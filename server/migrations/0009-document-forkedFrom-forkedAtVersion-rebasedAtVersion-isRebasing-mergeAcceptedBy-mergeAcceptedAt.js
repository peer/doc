import {Document} from '/lib/documents/document';

class Migration extends Document.AddRequiredFieldsMigration {
  name = "Adding forkedFrom, forkedAtVersion, rebasedAtVersion, isRebasing, mergeAcceptedBy, and mergeAcceptedAt fields";
  fields = {
    forkedFrom: null,
    forkedAtVersion: null,
    rebasedAtVersion: null,
    isRebasing: false,
    mergeAcceptedBy: null,
    mergeAcceptedAt: null,
  }
}

Document.addMigration(new Migration());
