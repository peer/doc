import {Plugin} from 'prosemirror-state';
import {Decoration, DecorationSet} from 'prosemirror-view';

export function placeholderPlugin(vueInstance, titlePlaceholder, paragraphPlaceholder) {
  return new Plugin({
    props: {
      decorations: (state) => {
        const decorations = [];
        let isThereParagraphWithContent = false;
        let emptyParagraph = null;

        const decorate = (node, pos) => {
          if (node.type.isBlock && node.childCount === 0) {
            if (node.type.name === 'paragraph') {
              // Only store empty paragraphs if there's no paragraph with childs.
              if (isThereParagraphWithContent) {
                return;
              }
              if (!emptyParagraph) {
                emptyParagraph = {node, pos};
              }
            }
            if (node.type.name === 'title') {
              // As the title nodeType is unique, we can add the decoration right away.
              decorations.push(Decoration.node(pos, pos + node.nodeSize, {
                'data-text': titlePlaceholder || vueInstance.$gettext("choose-title"),
                class: 'empty-node',
              }));
            }
          }
          else if (node.type.name === 'paragraph') {
            isThereParagraphWithContent = true;
          }
        };

        state.doc.descendants(decorate);

        if (emptyParagraph && !isThereParagraphWithContent) {
          decorations.push(Decoration.node(emptyParagraph.pos, emptyParagraph.pos + emptyParagraph.node.nodeSize, {
            'data-text': paragraphPlaceholder || vueInstance.$gettext("edit-content"),
            class: 'empty-node',
          }));
        }
        return DecorationSet.create(state.doc, decorations);
      },
    },
  });
}
