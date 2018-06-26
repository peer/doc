import {Plugin} from "prosemirror-state";
import {Snackbar} from '../../snackbar';

export const titleSizePlugin = (max, message) => {
  let lastOccurrenceAt = 0;
  return new Plugin({
    filterTransaction(tr, state) {
      if (tr.doc.content.firstChild.content.size > max) {
        const now = new Date();
        if (now - lastOccurrenceAt > 1000) {
          Snackbar.enqueue(message, 'warning');
        }
        lastOccurrenceAt = now;
        return false;
      }
      return true;
    },
  });
};
