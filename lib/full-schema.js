import {Schema} from 'prosemirror-model';
import {addListNodes} from 'prosemirror-schema-list';

export const nodes = {
  doc: {
    content: 'title (paragraph|block)+',
  },

  title: {
    content: 'inline*',
    marks: 'highlight',
    parseDOM: [{
      tag: 'h1',
    }],
    toDOM(node) {
      return ['h1', 0];
    },
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

  blockquote: {
    content: 'paragraph+',
    group: 'block',
    defining: true,
    parseDOM: [{
      tag: 'blockquote',
    }],
    toDOM(node) {
      return ['blockquote', 0];
    },
  },

  heading: {
    attrs: {
      level: {default: 1},
    },
    content: 'inline*',
    marks: 'strikethrough em highlight',
    group: 'block',
    defining: true,
    parseDOM: [{
      tag: 'h1',
      attrs: {level: 1},
    }, {
      tag: 'h2',
      attrs: {level: 2},
    }, {
      tag: 'h3',
      attrs: {level: 3},
    }],
    toDOM(node) {
      return [`h${node.attrs.level}`, 0];
    },
  },

  text: {
    group: 'inline',
  },
};

export const marks = {
  // Used to display content diffs.
  deleted: {
    toDOM(mark, inline) {
      return ['span', {class: 'deleted'}];
    },
  },

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
      return ['a', {...mark.attrs, title: mark.attrs.href}];
    },
  },

  highlight: {
    attrs: {
      'highlight-key': {},
    },
    inclusive: false,
    // By default, marks are exclusive with other marks of the same type.
    // So, the excludes option is set to an empty string to allow multiple
    // highlight marks to coexist.
    excludes: '',
    parseDOM: [{
      tag: 'span[data-highlight-key]',
      getAttrs(dom) {
        return {'highlight-key': dom.getAttribute('data-highlight-key')};
      },
    }],
    toDOM(mark, inline) {
      return ['span', {'data-highlight-key': mark.attrs['highlight-key'] || ''}];
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

const schemaWithoutListNodes = new Schema({nodes, marks});

export const schema = new Schema({
  nodes: addListNodes(schemaWithoutListNodes.spec.nodes, 'paragraph+ (ordered_list | bullet_list)*', 'block'),
  marks: schemaWithoutListNodes.spec.marks,
});
