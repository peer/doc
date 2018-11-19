import {_} from 'meteor/underscore';

import {Plugin} from 'prosemirror-state';
import {Decoration, DecorationSet} from 'prosemirror-view';

function getDecorations(doc, vueInstance) {
  const result = [];
  doc.descendants((node, pos) => {
    const highlightMarks = _.filter(node.marks, (m) => {
      return m.type.name === 'highlight';
    });

    if (highlightMarks.length) {
      const mark = highlightMarks.find((x) => {
        return x.attrs['highlight-key'] === vueInstance.currentHighlightKey;
      });
      if (mark) {
        result.push(Decoration.inline(pos, pos + node.nodeSize, {class: 'highlight--selected'}));
      }
      else {
        result.push(Decoration.inline(pos, pos + node.nodeSize, {class: 'highlight'}));
      }
    }
  });
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

