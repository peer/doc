import {Schema} from "prosemirror-model";
import {addListNodes} from "prosemirror-schema-list";

export const nodes = {
  doc: {
    content: "heading (paragraph|block)*",
  },
  paragraph: {
    content: "inline*",
    group: "block",
    parseDOM: [{tag: "p"}],
    toDOM() {
      return ["p", 0];
    },
  },
  blockquote: {
    content: "block+",
    group: "block",
    defining: true,
    parseDOM: [{tag: "blockquote"}],
    toDOM() {
      return ["blockquote", 0];
    },
  },
  heading: {
    attrs: {level: {default: 1}},
    content: "inline*",
    group: "block",
    defining: true,
    parseDOM: [{tag: "h1", attrs: {level: 1}},
               {tag: "h2", attrs: {level: 2}},
               {tag: "h3", attrs: {level: 3}}],
    toDOM(node) {
      return [`h${node.attrs.level}`, 0];
    },
  },

  text: {
    group: "inline",
  },

  image: {
    inline: true,
    attrs: {
      src: {},
      alt: {default: null},
      title: {default: null},
    },
    group: "inline",
    draggable: true,
    parseDOM: [{
      tag: "img[src]",
      getAttrs(dom) {
        return {
          src: dom.getAttribute("src"),
          title: dom.getAttribute("title"),
          alt: dom.getAttribute("alt"),
        };
      },
    }],
    toDOM(node) {
      return ["img", node.attrs];
    },
  },
};

export const marks = {
  strikeout: {
    toDOM: function toDOM() {
      return ["strikeout"];
    },
    parseDOM: [{tag: "strikeout"}],
  },

  link: {
    attrs: {
      href: {},
      title: {default: null},
    },
    inclusive: false,
    parseDOM: [{
      tag: "a[href]",
      getAttrs(dom) {
        return {href: dom.getAttribute("href"), title: dom.getAttribute("title")};
      },
    }],
    toDOM(node) {
      return ["a", node.attrs];
    },
  },

  em: {
    parseDOM: [{tag: "i"}, {tag: "em"}, {style: "font-style=italic"}],
    toDOM() {
      return ["em"];
    },
  },

  strong: {
    parseDOM: [{
      tag: "strong",
    },
    {
      tag: "b",
      getAttrs: (node) => {
        return node.style.fontWeight !== "normal" && null;
      },
    },
    {
      style: "font-weight",
      getAttrs: (value) => {
        return /^(bold(er)?|[5-9]\d{2,})$/.test(value) && null;
      },
    }],
    toDOM() {
      return ["strong"];
    },
  },

};

const tempSchema = new Schema({nodes, marks});

export const peerDocSchema = new Schema({
  nodes: addListNodes(tempSchema.spec.nodes, "paragraph block*", "block"),
  marks: tempSchema.spec.marks,
});
