import {Schema} from 'prosemirror-model';

export const nodes = {
  doc: {
    content: '(paragraph|block)+',
  },

  paragraph: {
    content: 'inline*',
    group: 'block',
    parseDOM: [{
      tag: 'p',
    }],
    toDOM(node) {
      return ['p', 0];
    },
  },

  text: {
    group: 'inline',
  },
};

export const marks = {
  strikethrough: {
    parseDOM: [{
      tag: 's',
    }, {
      tag: 'del',
    }],
    toDOM(mark, inline) {
      return ['del'];
    },
  },

  link: {
    attrs: {
      href: {},
    },
    inclusive: false,
    parseDOM: [{
      tag: 'a[href]',
      getAttrs(dom) {
        return {href: dom.getAttribute('href')};
      },
    }],
    toDOM(mark, inline) {
      return ['a', Object.assign({}, mark.attrs, {title: mark.attrs.href})];
    },
  },

  em: {
    parseDOM: [{
      tag: 'i',
    }, {
      tag: 'em',
    }, {
      style: 'font-style=italic',
    }],
    toDOM(mark, inline) {
      return ['em'];
    },
  },

  strong: {
    parseDOM: [{
      tag: 'strong',
    }, {
      tag: 'b',
      getAttrs: (node) => {
        return node.style.fontWeight !== 'normal' && null;
      },
    }, {
      style: 'font-weight',
      getAttrs: (value) => {
        return /^(bold(er)?|[5-9]\d{2,})$/.test(value) && null;
      },
    }],
    toDOM(mark, inline) {
      return ['strong'];
    },
  },
};

export const schema = new Schema({nodes, marks});
