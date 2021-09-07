import {Plugin} from 'prosemirror-state';
import {MarkType} from 'prosemirror-model';
import {RemoveMarkStep} from 'prosemirror-transform';

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
      (lastState
      && lastState.doc.eq(state.doc)
      && lastState.selection.eq(state.selection))
      || !this.vueInstance) {
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
      return {
        ...marksObj,
        marks: marksObj.marks.filter((m) => {
          return m.type.name === 'highlight';
        }),
      };
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

// Remove marks from inline nodes between `from` and `to`. When `mark`
// is a single mark, remove precisely that mark. When it is a mark type,
// remove all marks of that type. When it is null, remove all marks of
// any type.
function removeHighlightMark(tr, from, to, mark = null, highlightKey) {
  const matched = [];
  let step = 0;
  tr.doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isInline) return;
    step += 1;
    let toRemove = null;
    if (mark instanceof MarkType) {
      const found = node.marks.find((x) => {
        return x.attrs['highlight-key'] === highlightKey;
      });

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
    tr.step(new RemoveMarkStep(m.from, m.to, m.style));
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

export function addHighlight(key, schema, tr, from, to) {
  const attrs = {'highlight-key': key};
  tr.setMeta('addToHistory', false);
  return tr.addMark(from, to, schema.marks.highlight.create(attrs));
}

export function removeHighlight(schema, tr, doc, from, to, highlightKey) {
  if (doc.rangeHasMark(from, to, schema.marks.highlight)) {
    tr.setMeta('addToHistory', false);
    removeHighlightMark(tr, from, to, schema.marks.highlight, highlightKey);
  }
}
