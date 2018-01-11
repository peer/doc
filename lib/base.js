import {Document} from 'meteor/peerlibrary:peerdb';

export class BaseDocument extends Document {
  // Verbose name is used when representing the class in a non-technical
  // setting. The convention is not to capitalize the first letter of
  // the verboseName. We capitalize the first letter where we need to.
  static verboseName() {
    // Convert TitleCase into Title Case, and make lower case.
    return this.Meta._name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
  }

  static verboseNamePlural() {
    return `${this.verboseName()}s`;
  }

  static verboseNameWithCount(quantity = 0) {
    if (quantity === 1) {
      return `1 ${this.verboseName()}`;
    }
    return `${quantity} ${this.verboseNamePlural()}`;
  }

  verboseName() {
    return this.constructor.verboseName();
  }

  verboseNamePlural() {
    return this.constructor.verboseNamePlural();
  }

  verboseNameWithCount(quantity) {
    return this.constructor.verboseNameWithCount(quantity);
  }

  static methodPrefix() {
    return this.Meta._name;
  }

  methodPrefix() {
    return this.constructor.methodPrefix();
  }

  static PUBLISH_FIELDS() {
    return {};
  }
}

BaseDocument.Meta({
  abstract: true,
});
