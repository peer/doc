import {Plugin} from 'prosemirror-state';
import {Decoration, DecorationSet} from 'prosemirror-view';

/**
 * Creates decorations for each user current position in the document
 * @param {*} doc - Current document
 * @param {*} positions - Positions array, each object needs a 'from' and 'to' property
 */
function getDecorations(doc, positions) {
  const decos = positions.map((pos) => {
    return Decoration.inline(pos.from, pos.to, {class: "highlight"});
  });
  return DecorationSet.create(doc, decos);
}

/**
 * Cursors Plugin for ProseMirror that excpects to use
 * an array of other users positions as a metadata for
 * the current transaction.
 * It stores an DecoarionSet as its state.
 */
export const cursorsPlugin = new Plugin({
  state: {
    init(_, {doc}) {
      return DecorationSet.empty;
    },
    apply(tr, old) {
      if (tr.getMeta(cursorsPlugin)) {
        return getDecorations(tr.doc, tr.getMeta(cursorsPlugin));
      }
      return old;
    },
  },
  props: {
    decorations(state) {
      return this.getState(state);
    },
  },
});
