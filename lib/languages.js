import {Meteor} from 'meteor/meteor';
import {_} from 'meteor/underscore';

export const availableLanguages = {
  en_US: "American English",
  pt_BR: "Português do Brasil",
};

export function getLanguage(languageCode) {
  if (languageCode && _.has(availableLanguages, languageCode)) {
    return languageCode;
  }
  else {
    return Meteor.settings.public.defaultLanguage || 'en_US';
  }
}
