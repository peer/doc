import {BaseDocument} from '/lib/base';

export class Snackbar extends BaseDocument {
  // createdAt: time of document creation
  // message: text of the snackbar
  // color: color of the snackbar ("success", "info", "error", etc.)

  static enqueue(message, color) {
    this.documents.insert({
      createdAt: new Date(),
      message,
      color
    })
  }
}

Snackbar.Meta({
  name: 'Snackbar',
  collection: null
});
