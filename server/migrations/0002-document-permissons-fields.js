import {Document} from '/server/documents/document';

class Migration extends Document.AddRequiredFieldsMigration {
  name = "Adding userPermissions, visibility, and defaultPermissions fields";
  fields = {
    userPermissions: [],
    visibility: Document.VISIBILITY_LEVELS.PRIVATE,
    defaultPermissions: Document.getPermissionsFromRole(Document.ROLES.VIEW),
  };
}

Document.addMigration(new Migration());
