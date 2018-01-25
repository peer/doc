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
  constructor(items, editorView) {
    this.items = items;
    this.editorView = editorView;
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

      const enabled = command(state, null, this.editorView);

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


export function menuPlugin(items) {
  return new Plugin({
    view(editorView) {
      const menuView = new MenuView(items, editorView);
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
