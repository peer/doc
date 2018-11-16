import {Plugin} from 'prosemirror-state';
import {Decoration, DecorationSet} from 'prosemirror-view';

export const diffPlugin = new Plugin({
  state: {
    init(config, {doc}) {
      return DecorationSet.empty;
    },

    apply(tr, old) {
      const changeset = tr.getMeta(diffPlugin);

      if (!changeset) {
        return old;
      }

      const decorations = [];

      for (const span of changeset.inserted) {
        decorations.push(Decoration.inline(span.from, span.to, {class: 'inserted'}));
      }

      return DecorationSet.create(tr.doc, decorations);
    },
  },

  props: {
    decorations(state) {
      return this.getState(state);
    },
  },
});
