import {Plugin} from "prosemirror-state";

class AddComment {
  constructor(view, vueInstance) {
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
    const {selection} = state;
    if (
      (lastState &&
      lastState.doc.eq(state.doc) &&
      lastState.selection.eq(state.selection)) ||
      !this.vueInstance) {
      return;
    }

    const marks = [];
    state.doc.nodesBetween(selection.from, selection.to, (node, start, parent, index) => {
      marks.push({marks: node.marks, start, size: node.nodeSize});
    });
    marks.shift(); // the first element always comes empty, so we remove it
    let onlyHighlightMarkInRange = true;
    marks.forEach((marksObj) => {
      if (!marksObj.marks.length) {
        onlyHighlightMarkInRange = false;
      }
      if (!marksObj.marks.filter((m) => {
        return m.type.name === 'highlight';
      }).length) {
        onlyHighlightMarkInRange = false;
      }
    });
    this.vueInstance.selectedExistingHighlights = marks.filter((marksObj) => {
      return marksObj.marks.length;
    }).map((marksObj) => {
      return Object.assign({}, marksObj, {
        marks: marksObj.marks.filter((m) => {
          return m.type.name === "highlight";
        }),
      });
    }).filter((marksObj) => {
      return marksObj.marks.length;
    });

    if (this.vueInstance.canUserCreateComments) {
      const {from} = state.selection;
      // These are in screen coordinates
      const start = view.coordsAtPos(from);

      // Hide the comment box if the selection is empty or the selection
      // only contains highlight marks.
      if (state.selection.empty || onlyHighlightMarkInRange) {
        this.vueInstance.updateNewCommentForm(false);
      }
      else {
        this.vueInstance.updateNewCommentForm(true, start);
      }
    }
    else {
      this.vueInstance.updateNewCommentForm(false);
    }
  }
}

export default function addCommentPlugin(vueInstance) {
  return new Plugin({
    view(editorView) {
      return new AddComment(editorView, vueInstance);
    },
  });
}

export function addHighlight(keys, schema, tr, from, to, dispatch) {
  const attrs = {"highlight-keys": keys};
  tr.setMeta("addToHistory", false);
  return tr.addMark(from, to, schema.marks.highlight.create(attrs));
}

export function removeHighlight(schema, tr, doc, from, to, dispatch) {
  if (dispatch) {
    if (doc.rangeHasMark(from, to, schema.marks.highlight)) {
      tr.setMeta("addToHistory", false);
      return tr.removeMark(from, to, schema.marks.highlight);
    }
  }
  return null;
}

export function updateChunks(previousChunks, splitChunk, {from, to}) {
  let chunk1 = null;
  let chunk3 = null;
  if (splitChunk.from < from) {
    chunk1 = {
      from: splitChunk.from,
      to: from,
      empty: true,
    };
  }
  const chunk2 = {
    from,
    to,
    empty: false,
  };
  if (splitChunk.to > to) {
    chunk3 = {
      from: to,
      to: splitChunk.to,
      empty: true,
    };
  }

  const index = previousChunks.indexOf(splitChunk);
  const newChunks = previousChunks;
  newChunks.splice(index, 1);
  if (chunk1) {
    newChunks.splice(index, 0, chunk1);
  }

  newChunks.splice(index + 1, 0, chunk2);

  if (chunk3) {
    newChunks.splice(index + 2, 0, chunk3);
  }

  return newChunks;
}
