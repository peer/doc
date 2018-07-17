import {BaseDocument} from '/lib/base';

export class Snackbar extends BaseDocument {
  // createdAt: time of document creation
  // message: text of the snackbar
  // color: color of the snackbar ("success", "info", "error", etc.)
  // shown: true if already shown

  static enqueue(message, color) {
    this.documents.insert({
      createdAt: new Date(),
      shown: false,
      message,
      color,
    });
  }
}

Snackbar.Meta({
  name: 'Snackbar',
  collection: null,
});
