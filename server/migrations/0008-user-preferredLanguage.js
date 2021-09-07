import {User} from '/lib/documents/user';

class Migration extends Document.AddRequiredFieldsMigration {
  name = "Adding preferredLanguage field";

  fields = {
    preferredLanguage: null,
  };
}

User.addMigration(new Migration());
