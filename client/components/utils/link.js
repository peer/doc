import {toggleMark} from 'prosemirror-commands';
import {TextSelection} from 'prosemirror-state';
import {isMarkActive, hasMark} from './menu.js';

function expandLinkSelection(editorView) {
  const {from, to} = editorView.state.selection;

  if (to > from) {
    // Nothing to do. A non-empty selection.
    return;
  }

  const $pos = editorView.state.doc.resolve(from);

  const start = $pos.parent.childAfter($pos.parentOffset);
  if (!start.node) {
    return;
  }

  const link = start.node.marks.find((mark) => {
    return mark.type === editorView.state.schema.marks.link;
  });
  if (!link) {
    return;
  }

  let startIndex = $pos.index();
  let startPos = $pos.start() + start.offset;
  while (startIndex > 0 && link.isInSet($pos.parent.child(startIndex - 1).marks)) {
    startIndex -= 1;
    startPos -= $pos.parent.child(startIndex).nodeSize;
  }

  let endIndex = $pos.indexAfter();
  let endPos = startPos + start.node.nodeSize;
  while (endIndex < $pos.parent.childCount && link.isInSet($pos.parent.child(endIndex).marks)) {
    endPos += $pos.parent.child(endIndex).nodeSize;
    endIndex += 1;
  }

  const {tr} = editorView.state;
  tr.setSelection(TextSelection.create(tr.doc, startPos, endPos));
  editorView.dispatch(tr);
}

function getAllHrefs(state) {
  const {from, to} = state.selection;
  const hrefs = new Set();

  function processNode(node) {
    if (node === null) {
      // Not necessary, but to match the other return.
      return true;
    }

    const link = node.marks.find((mark) => {
      return mark.type === state.schema.marks.link;
    });
    if (link && link.attrs.href) {
      hrefs.add(link.attrs.href);
    }

    // For "nodesBetween" to continue traversing.
    return true;
  }

  if (to > from) {
    state.doc.nodesBetween(from, to, processNode);
  }
  else {
    processNode(state.doc.nodeAt(from));
  }

  return Array.from(hrefs);
}

export function toggleLink(linkDialogRef) {
  return function onToggle(state, dispatch, editorView) {
    if (state.selection.empty && !hasMark(state, state.schema.marks.link)) {
      return false;
    }
    if (dispatch) {
      expandLinkSelection(editorView);
      const selectedExistingLinks = getAllHrefs(editorView.state);
      linkDialogRef.openLinkDialog(selectedExistingLinks);
      return true;
    }
    else {
      return toggleMark(state.schema.marks.link)(state);
    }
  };
}

export function clearLink(editorView) {
  if (isMarkActive(editorView.state.schema.marks.link)(editorView.state)) {
    toggleMark(editorView.state.schema.marks.link)(editorView.state, editorView.dispatch);
  }
}
