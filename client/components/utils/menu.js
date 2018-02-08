import {Plugin} from "prosemirror-state";
import {wrapIn, lift, setBlockType, toggleMark} from "prosemirror-commands";

function checkMarkup(state, markup, attr) {
  for (let i = 0; i < state.selection.$from.path.length; i += 1) {
    if (typeof state.selection.$from.path[i] !== 'number' && state.selection.$from.path[i].hasMarkup(markup, attr)) {
      return true;
    }
  }
  return false;
}

/**
 * Check links on selection range and ad those to an
 * array along with their positions
 * @param {*} state
 * @param {*} selection
 */
function handleLink(state, selection) {
  const rangeLinks = [];
  state.doc.nodesBetween(selection.from, selection.to, (node, start, parent, index) => {
    const linked =
          node &&
          node.marks.length &&
          node.marks[0] &&
          node.marks[0].attrs &&
          node.marks[0].attrs.href;
    if (linked) {
      rangeLinks.push({node, start});
    }
  });
  let selectedExistingLinks;
  if (rangeLinks.length) {
    selectedExistingLinks = rangeLinks.map(({start, node}) => {
      return {
        position: {
          from: start,
          to: start + node.nodeSize,
        },
        href: node.marks[0].attrs.href,
      };
    });
  }
  else {
    selectedExistingLinks = null;
  }
  return {selectedExistingLinks, linked: Boolean(rangeLinks.length)};
}

export function toggleHeading(level) {
  return function onToggle(state, dispatch) {
    if (checkMarkup(state, state.schema.nodes.heading, {level})) {
      return setBlockType(state.schema.nodes.paragraph)(state, dispatch);
    }
    else {
      return setBlockType(state.schema.nodes.heading, {level})(state, dispatch);
    }
  };
}

export function toggleBlockquote() {
  return function onToggle(state, dispatch) {
    if (checkMarkup(state, state.schema.nodes.blockquote)) {
      return lift(state, dispatch);
    }
    else {
      return wrapIn(state.schema.nodes.blockquote)(state, dispatch);
    }
  };
}

class MenuView {
  constructor(items, editorView, vueInstance) {
    this.items = items;
    this.editorView = editorView;
    this.vueInstance = vueInstance;
    this.dom = document.getElementById("tools");
    this.update();

    this.dom.addEventListener("mousedown", (e) => {
      e.preventDefault();
      editorView.focus();
      items.forEach(({command, dom}) => {
        if (dom.contains(e.target)) {
          command(editorView.state, editorView.dispatch, editorView);
        }
      });
    });
  }

  update() {
    const {state} = this.editorView;
    const {selection} = state;
    const {vueInstance} = this;
    this.items.forEach(({
      command, dom, node, mark, attr,
    }) => {
      let active = false;
      let btnClass = dom.className.replace(' btn--active', '').replace(' btn--disabled', '');
      if (mark) {
        active = state.doc.rangeHasMark(selection.from, selection.to, mark);
      }
      else if (node) {
        active = checkMarkup(state, node, attr);
      }

      let hasLink;
      if (attr && attr.link) {
        const respLink = handleLink(state, selection);
        hasLink = respLink.linked;
        vueInstance.selectedExistingLinks = respLink.selectedExistingLinks || [];
      }

      const enabled = hasLink || command(state, null, this.editorView);

      if (!enabled) {
        btnClass += " btn--disabled";
      }

      if (active) {
        btnClass += " btn--active";
      }

      dom.className = btnClass; // eslint-disable-line no-param-reassign
    });
  }

  destroy() {
    this.dom.remove();
  }
}

export function menuPlugin(items, vueInstance) {
  return new Plugin({
    view(editorView) {
      const menuView = new MenuView(items, editorView, vueInstance);
      editorView.dom.parentNode.insertBefore(menuView.dom, editorView.dom);
      return menuView;
    },
  });
}

export function icon(text, name) {
  const span = document.createElement("span");
  span.className = `menuicon ${name}`;
  span.title = name;
  span.textContent = text;
  return span;
}

export function heading(level, schema) {
  return {
    command: toggleHeading(level),
    dom: document.getElementById(`h${level}`),
    node: schema.nodes.heading,
    attr: {level},
  };
}

export function toggleLink(schema, clicked, url) {
  return function onToggle(state, dispatch) {
    const {doc, selection} = state;
    if (selection.empty) {
      return false;
    }
    let attrs = null;
    if (dispatch) {
      if (!clicked) {
        return false;
      }
      if (!doc.rangeHasMark(selection.from, selection.to, schema.marks.link)) {
        attrs = {href: url};
        if (!attrs.href) {
          return false;
        }
      }
    }
    return toggleMark(schema.marks.link, attrs)(state, dispatch);
  };
}
