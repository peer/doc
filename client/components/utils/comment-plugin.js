import {_} from 'meteor/underscore';
import {Plugin} from 'prosemirror-state';
import {Decoration, DecorationSet} from 'prosemirror-view';

function getDecorations(doc, vueInstance) {
  const result = [];
  const keys = [];
  doc.descendants((node, pos) => {
    const mark = _.find(node.marks, (m) => {
      return m.type.name === "highlight";
    });
    if (mark) {
      keys.push(mark.attrs["highlight-keys"].split(","));
      if (vueInstance.currentHighlightKey && mark.attrs["highlight-keys"].split(",").indexOf(vueInstance.currentHighlightKey) >= 0) {
        result.push(Decoration.inline(pos, pos + node.nodeSize, {class: "highlight--selected"}));
      }
      else {
        result.push(Decoration.inline(pos, pos + node.nodeSize, {class: "highlight"}));
      }
    }
  });
  vueInstance.filterComments(_.flatten(keys));
  vueInstance.currentHighlightKeyChanged = false; // eslint-disable-line no-param-reassign
  return DecorationSet.create(doc, result);
}
export const commentPlugin = (vueInstance) => {
  return new Plugin({
    state: {
      init(config, {doc}) {
        return DecorationSet.empty;
      },
      apply(tr, old) {
        return tr.docChanged || vueInstance.currentHighlightKeyChanged ? getDecorations(tr.doc, vueInstance) : old;
      },
    },
    props: {
      decorations(state) {
        return this.getState(state);
      },
    },
  });
};

