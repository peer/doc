import {Plugin} from "prosemirror-state";
import {Snackbar} from '../../snackbar';

export const titleSizePlugin = (max, message) => {
  let lastOccurrenceAt = 0;
  return new Plugin({
    filterTransaction(tr, state) {
      // Check if the transaction title length is greater than the limit
      if (tr.doc.content.firstChild.content.size > max) {
        const now = new Date();

        // Check if the title is modified in the transaction
        const replacedTitle = state.doc.content.firstChild.content.size !== tr.doc.content.firstChild.content.size;

        // Show snackbar only when the title is modified.
        if (replacedTitle && now - lastOccurrenceAt > 1000) {
          Snackbar.enqueue(message, 'warning');
        }

        lastOccurrenceAt = now;

        // If false is returned the transaction will be cancelled, it works fine when
        // the title is modified by only one user, but when it's modified by two (or
        // more) users at the same time a mismatch could occur. For this reason, the
        // line below is commented.
        // return false;
      }
      return true;
    },
  });
};
