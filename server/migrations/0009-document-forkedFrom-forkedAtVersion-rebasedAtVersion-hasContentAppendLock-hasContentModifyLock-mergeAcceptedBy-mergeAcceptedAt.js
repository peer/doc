import {Document} from '/lib/documents/document';

class Migration extends Document.AddRequiredFieldsMigration {
  name = "Adding forkedFrom, forkedAtVersion, rebasedAtVersion, hasContentAppendLock, hasContentModifyLock, mergeAcceptedBy, and mergeAcceptedAt fields";
  fields = {
    forkedFrom: null,
    forkedAtVersion: null,
    rebasedAtVersion: null,
    hasContentAppendLock: null,
    hasContentModifyLock: null,
    mergeAcceptedBy: null,
    mergeAcceptedAt: null,
  }
}

Document.addMigration(new Migration());
