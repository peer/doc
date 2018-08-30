import {User} from '/server/documents/user';

class Migration extends Document.AddRequiredFieldsMigration {
  name = "Adding preferredLanguage field";
  fields = {
    preferredLanguage: null,
  };
}

User.addMigration(new Migration());
