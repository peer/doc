import {Plugin} from "prosemirror-state";

import {toggleMark} from "prosemirror-commands";

class AddComment {
  constructor(view, vueInstance) {
    view.dom.parentNode.appendChild(vueInstance.$refs.addCommentButton.$el);
    this.update(view, null);
    this.vueInstance = vueInstance;
  }

  /**
   * Function that is being called with every action from the editor, here we
   * check if a selection was made and show the "Add Comment" button.
   * @param {F} view - EditorView from ProseMirror
   * @param {*} lastState - Previous State
   */
  update(view, lastState) {
    const {state} = view;
    if (
      (lastState &&
      lastState.doc.eq(state.doc) &&
      lastState.selection.eq(state.selection)) ||
      !this.vueInstance) {
      return;
    }

    const button = this.vueInstance.$refs.addCommentButton;
    // Hide the comment button if the selection is empty
    if (state.selection.empty) {
      button.$el.style.opacity = 0;
      button.$el.style.visibility = 'hidden';
      return;
    }

    button.$el.style.opacity = 0.75;
    button.$el.style.visibility = 'visible';
    const {from} = state.selection;
    // These are in screen coordinates
    const start = view.coordsAtPos(from);
    // The box in which the comment button is positioned, to use as base
    const box = button.$el.offsetParent.getBoundingClientRect();
    button.$el.style.bottom = `${(box.bottom - start.bottom)}px`;
  }
}

export default function addCommentPlugin(vueInstance) {
  return new Plugin({
    view(editorView) {
      return new AddComment(editorView, vueInstance);
    },
  });
}

export function toggleComment(id, schema, state, dispatch) {
  const {doc, selection} = state;
  if (selection.empty) {
    return false;
  }
  let attrs = null;
  if (dispatch) {
    if (!doc.rangeHasMark(selection.from, selection.to, schema.marks.comment)) {
      attrs = {"data-highlight-ids": id};
      if (!attrs["data-highlight-ids"]) {
        return false;
      }
    }
  }
  return toggleMark(schema.marks.comment, attrs)(state, dispatch);
}
