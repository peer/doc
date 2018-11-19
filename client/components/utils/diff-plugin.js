import {Plugin} from 'prosemirror-state';
import {Decoration, DecorationSet} from 'prosemirror-view';
import {DOMSerializer} from 'prosemirror-model';
import stringify from 'fast-json-stable-stringify';

import {schema} from '/lib/full-schema';

function deletedDom(span) {
  return function toDom(view, getPos) {
    const serializer = DOMSerializer.fromSchema(view.state.schema);
    return serializer.serializeFragment(span.slice.content);
  };
}

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

      for (const span of changeset.deleted) {
        decorations.push(Decoration.widget(span.pos, deletedDom(span), {side: -1, marks: [schema.marks.deleted.create()], key: stringify(span.slice.toJSON())}));
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
