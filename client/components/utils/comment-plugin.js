import {_} from 'meteor/underscore';
import {Plugin} from 'prosemirror-state';
import {Decoration, DecorationSet} from 'prosemirror-view';

function getDecorations(doc, vueInstance) {
  const result = [];
  const keys = [];
  doc.descendants((node, pos) => {
    const mark = _.find(node.marks, (m) => {
      return m.type.name === "comment";
    });
    if (mark) {
      keys.push(mark.attrs["data-highlight-keys"].split(","));
      result.push(Decoration.inline(pos, pos + node.nodeSize, {class: "comment"}));
    }
  });
  vueInstance.filterComments(_.flatten(keys));
  return DecorationSet.create(doc, result);
}
export const commentPlugin = (vueInstance) => {
  return new Plugin({
    state: {
      init(config, {doc}) {
        return DecorationSet.empty;
      },
      apply(tr, old) {
        return tr.docChanged ? getDecorations(tr.doc, vueInstance) : old;
      },
    },
    props: {
      decorations(state) {
        return this.getState(state);
      },
    },
  });
};

