import {Plugin} from "prosemirror-state";
import {extractTitle} from '/lib/utils';
import {Snackbar} from '../../snackbar';

export const titleSizePlugin = (max, message) => {
  let lastOccurrenceAt = 0;
  let lastTransactionTime = 0;
  return new Plugin({
    filterTransaction(tr, state) {
      // We care only about local transactions which are in "collab" plugin state.
      for (const rebaseable of state.collab$.unconfirmed) {
        // To not re-process local transactions.
        if (rebaseable.origin.time <= lastTransactionTime) {
          continue;
        }
        lastTransactionTime = rebaseable.origin.time;

        const trTitleLength = extractTitle(rebaseable.origin.doc).length;

        // Check if the transaction title length is greater than the limit.
        if (trTitleLength > max) {
          const now = new Date();

          // Check if message is already being show or enqueued.
          const alreadyEnqueued = Snackbar.documents.exists({message});

          // Show snackbar only when not already enqueued, and more than
          // 1 second passed since the last transaction.
          if (!alreadyEnqueued && now - lastOccurrenceAt > 1000) {
            Snackbar.enqueue(message, 'warning');
          }

          lastOccurrenceAt = now;
        }
      }

      // We don't want to prevent the transaction, because when the title
      // is modified by two (or more) users at the same time a mismatch could
      // occur (the transaction with the rebase step would be prevented). So,
      // we always return true.
      return true;
    },
  });
};
