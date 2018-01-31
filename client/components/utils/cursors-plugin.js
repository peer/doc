import {Plugin} from 'prosemirror-state';
import {Decoration, DecorationSet} from 'prosemirror-view';

/**
 * Helper function that creates a DOM.node with the cursor to render
 * @param {*} color - String with the hex color to use
 */
function createCaret(color, name) {
  const caretContainer = document.createElement('div');
  caretContainer.className = 'caret-container';
  const caretHead = document.createElement('div');
  caretHead.className = 'caret-head';
  caretHead.style.backgroundColor = color;
  const caretBody = document.createElement('div');
  caretBody.className = 'caret-body';
  caretBody.style.borderColor = color;
  caretBody.style.borderLeftColor = color;
  const caretName = document.createElement('div');
  caretName.className = 'caret-name';
  caretName.innerHTML = name || '';
  caretName.style.backgroundColor = color;
  caretContainer.appendChild(caretHead);
  caretContainer.appendChild(caretBody);
  caretContainer.appendChild(caretName);
  return caretContainer;
}
/**
 * Creates decorations for each user current position in the document
 * @param {*} doc - Current document
 * @param {*} positions - Positions array, each object needs a 'from' and 'to' property
 */
function getDecorations(doc, positions) {
  const decosInline = positions.map((pos) => {
    return Decoration.inline(pos.from, pos.to, {
      class: "highlight",
      style: `background-color: ${pos.color}`,
    });
  });

  const decosWidget = positions.map((pos) => {
    return Decoration.widget(pos.to, createCaret(pos.color, pos.username));
  });
  return DecorationSet.create(doc, [...decosInline, ...decosWidget]);
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
