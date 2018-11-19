import {_} from 'meteor/underscore';

import {Plugin} from 'prosemirror-state';
import {Decoration, DecorationSet} from 'prosemirror-view';

/**
 * Helper function that creates a DOM.node with the cursor to render.
 */
function createCaret(color, name, avatarUrl) {
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
  if (avatarUrl) {
    const imgAvatar = document.createElement('img');
    imgAvatar.className = 'caret-img';
    imgAvatar.setAttribute('src', avatarUrl);
    imgAvatar.setAttribute('height', '25px');
    caretName.appendChild(imgAvatar);
  }
  const textSpan = document.createElement('span');
  textSpan.className = 'caret-username';
  textSpan.textContent = name || 'Anonymous';
  caretName.appendChild(textSpan);
  caretName.style.backgroundColor = color;
  caretContainer.appendChild(caretHead);
  caretContainer.appendChild(caretBody);
  caretContainer.appendChild(caretName);
  return caretContainer;
}
/**
 * Creates decorations for each user current position in the document.
 */
function getDecorations(doc, positions) {
  const decosInline = _.flatten(positions.map((pos) => {
    return pos.ranges.map((range) => {
      return Decoration.inline(
        range.beginning,
        range.end,
        {
          class: 'user-selection',
          style: `background-color: ${pos.color}`,
        },
      );
    });
  }));

  const decosWidget = positions.map((pos) => {
    return Decoration.widget(pos.head, createCaret(pos.color, pos.username, pos.avatarUrl));
  });
  return DecorationSet.create(doc, [...decosInline, ...decosWidget]);
}

/**
 * Cursors Plugin for ProseMirror that expects to use
 * an array of other users positions as a metadata for
 * the current transaction.
 * It stores an DecorationSet as its state.
 */
export const cursorsPlugin = new Plugin({
  state: {
    init(config, {doc}) {
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
