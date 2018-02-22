import {_} from 'meteor/underscore';
import {Plugin} from 'prosemirror-state';
import {Decoration, DecorationSet} from 'prosemirror-view';

function getDecorations(doc) {
  const result = [];

  doc.descendants((node, pos) => {
    const mark = _.find(node.marks, (m) => {
      return m.type.name === "comment";
    });
    if (mark) {
      result.push(Decoration.inline(pos, pos + node.nodeSize, {class: "comment"}));
    }
  });
  return DecorationSet.create(doc, result);
}
export const commentPlugin = new Plugin({
  state: {
    init(config, {doc}) {
      return getDecorations(doc);
    },
    apply(tr, old) {
      return tr.docChanged ? getDecorations(tr.doc) : old;
    },
  },
  props: {
    decorations(state) {
      return this.getState(state);
    },
  },
});
