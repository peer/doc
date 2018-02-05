import {Plugin} from 'prosemirror-state';
import {Decoration, DecorationSet} from 'prosemirror-view';

/**
 * Create DOM element with current link information
 * @param {*} link
 * @param {*} pos
 * @param {*} node
 * @param {*} vueRef
 */
function createBubble(link, pos, node, vueRef) {
  const container = document.createElement('div');
  container.className = 'bubble';
  const content = document.createElement('div');
  content.className = 'link-bubble';
  const linkEl = document.createElement('a');
  linkEl.href = link;
  linkEl.target = '_blank';
  linkEl.innerHTML = link;
  content.appendChild(linkEl);
  const span = document.createElement('span');
  content.appendChild(span);
  const changeSpan = document.createElement('span');
  changeSpan.innerHTML = '<a href="#">Change</a>';
  changeSpan.className = 'link-bubble-link';
  changeSpan.onclick = (e) => {
    e.preventDefault();
    vueRef.linkDialog = true; // eslint-disable-line
    vueRef.linkNode = {node, pos}; // eslint-disable-line
  };
  const removeSpan = document.createElement('span');
  removeSpan.innerHTML = '<a href="#">Remove</a>';
  removeSpan.className = 'link-bubble-link';
  removeSpan.onclick = (e) => {
    e.preventDefault();
    vueRef.removeLink({node, pos});
  };
  span.innerHTML = ' – ';
  span.appendChild(changeSpan);
  span.insertAdjacentHTML('beforeend', ' | ');
  span.appendChild(removeSpan);
  container.appendChild(content);
  return container;
}

/**
 * Creates decorations for each user link position
 * @param {*} doc - Current document
 * @param {*} vueRef - Current Vue instance
 */
function getDecorations(doc, vueRef) {
  const decos = [];
  doc.descendants((node, pos) => {
    const mark = node.marks.find((m) => {
      return m.type.name === 'link';
    });
    if (mark) {
      const {href} = mark.attrs;
      decos.push(Decoration.widget(pos + 1, createBubble(href, pos, node, vueRef)));
    }
  });
  return DecorationSet.create(doc, decos);
}

export const linkPlugin = (vueRef) => {
  return new Plugin({
    state: {
      init(_, {doc}) {
        return DecorationSet.empty;
      },
      apply(tr, old) {
        return tr.docChanged ? getDecorations(tr.doc, vueRef) : old;
      },
    },
    props: {
      decorations(state) {
        return this.getState(state);
      },
    },
  });
};
