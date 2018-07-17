import {Plugin} from 'prosemirror-state';
import {MarkType} from 'prosemirror-model';

import {AddHighlightStep, RemoveHighlightStep} from '/lib/transform/highlight_step';

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
          return m.type.name === 'highlight';
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

// Add the given mark to the inline content between `from` and `to`.
function addHighlightMark(tr, from, to, mark) {
  const removed = [];
  const added = [];
  let removing = null;
  let adding = null;

  tr.doc.nodesBetween(from, to, (node, pos, parent) => {
    if (!node.isInline) return;
    const marks = node.marks;
    if (!mark.isInSet(marks) && parent.type.allowsMarkType(mark.type)) {
      const start = Math.max(pos, from);
      const end = Math.min(pos + node.nodeSize, to);
      const newSet = mark.addToSet(marks);

      for (let i = 0; i < marks.length; i += 1) {
        if (!marks[i].isInSet(newSet)) {
          if (removing && removing.to === start && removing.mark.eq(marks[i])) {
            removing.to = end;
          }
          else {
            removed.push(removing = new RemoveHighlightStep(start, end, marks[i]));
          }
        }
      }

      if (adding && adding.to === start) {
        adding.to = end;
      }
      else {
        added.push(adding = new AddHighlightStep(start, end, mark));
      }
    }
  });

  removed.forEach((s) => {
    tr.step(s);
  });
  added.forEach((s) => {
    tr.step(s);
  });
  return tr;
}

// Remove marks from inline nodes between `from` and `to`. When `mark`
// is a single mark, remove precisely that mark. When it is a mark type,
// remove all marks of that type. When it is null, remove all marks of
// any type.
function removeHighlightMark(tr, from, to, mark = null) {
  const matched = [];
  let step = 0;
  tr.doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isInline) return;
    step += 1;
    let toRemove = null;
    if (mark instanceof MarkType) {
      const found = mark.isInSet(node.marks);
      if (found) toRemove = [found];
    }
    else if (mark) {
      if (mark.isInSet(node.marks)) toRemove = [mark];
    }
    else {
      toRemove = node.marks;
    }
    if (toRemove && toRemove.length) {
      const end = Math.min(pos + node.nodeSize, to);
      for (let i = 0; i < toRemove.length; i += 1) {
        const style = toRemove[i];
        let found;
        for (let j = 0; j < matched.length; j += 1) {
          const m = matched[j];
          if (m.step === step - 1 && style.eq(matched[j].style)) found = m;
        }
        if (found) {
          found.to = end;
          found.step = step;
        }
        else {
          matched.push({style, from: Math.max(pos, from), to: end, step});
        }
      }
    }
  });
  matched.forEach((m) => {
    tr.step(new RemoveHighlightStep(m.from, m.to, m.style));
  });
  return tr;
}

export default function addCommentPlugin(vueInstance) {
  return new Plugin({
    view(editorView) {
      return new AddComment(editorView, vueInstance);
    },
  });
}

export function addHighlight(keys, schema, tr, from, to, dispatch) {
  const attrs = {'highlight-keys': keys};
  tr.setMeta('addToHistory', false);
  return addHighlightMark(tr, from, to, schema.marks.highlight.create(attrs));
}

export function removeHighlight(schema, tr, doc, from, to, dispatch) {
  if (dispatch) {
    if (doc.rangeHasMark(from, to, schema.marks.highlight)) {
      tr.setMeta('addToHistory', false);
      return removeHighlightMark(tr, from, to, schema.marks.highlight);
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
