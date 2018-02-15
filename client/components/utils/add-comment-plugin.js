import {Plugin} from "prosemirror-state";

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
    // Hide the tooltip if the selection is empty
    if (state.selection.empty) {
      button.$el.style.opacity = 0;
      button.$el.style.display = 'none';
      return;
    }

    button.$el.style.opacity = 0.9;
    button.$el.style.display = '';
    const {from} = state.selection;
    // These are in screen coordinates
    const start = view.coordsAtPos(from);
    // The box in which the tooltip is positioned, to use as base
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
