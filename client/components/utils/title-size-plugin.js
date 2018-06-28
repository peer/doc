import {Plugin} from "prosemirror-state";
import {extractTitle} from '/lib/utils';
import {Snackbar} from '../../snackbar';

export const titleSizePlugin = (max, message) => {
  let lastOccurrenceAt = 0;
  return new Plugin({
    filterTransaction(tr, state) {
      const stateTitleLength = extractTitle(state.doc).length;
      const trTitleLength = extractTitle(tr.doc).length;
      // Check if the transaction title length is greater than the limit
      if (trTitleLength > max) {
        const now = new Date();

        // Check if the title is modified in the transaction
        const replacedTitle = stateTitleLength !== trTitleLength;

        // Show snackbar only when the title is modified.
        if (replacedTitle && now - lastOccurrenceAt > 1000) {
          Snackbar.enqueue(message, 'warning');
        }

        lastOccurrenceAt = now;
      }
      // We don't want to prevent the transaction, because when the title
      // is modified by two (or more) users at the same time a mismatch could
      // occur (the transaction with the rebase step would be prevented). So,
      // we always return true.
      return true;
    },
  });
};
