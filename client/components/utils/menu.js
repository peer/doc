import {Plugin} from "prosemirror-state";
import {setBlockType, toggleMark} from "prosemirror-commands";

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
    this.items.forEach(({command, dom}) => {
      let active = command(this.editorView.state, null, this.editorView);
      dom.style.display = active ? "" : "none";
    });
  }

  destroy() {
    this.dom.remove();
  }
}


export function menuPlugin(items) {
  return new Plugin({
    view(editorView) {
      let menuView = new MenuView(items, editorView);
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
    command: setBlockType(schema.nodes.heading, {level}),
    dom: document.getElementById(`h${level}`),
  };
}

export function toggleLink(schema) {
  return function (state, dispatch) {
    let {doc, selection} = state;
    if (selection.empty) {
      return false;
    }
    let attrs = null;
    if (dispatch) {
      if (!doc.rangeHasMark(selection.from, selection.to, schema.marks.link)) {
        attrs = {href: prompt("Link to where?", "")};
        if (!attrs.href) {
          return false;
        }
      }
    }
    return toggleMark(schema.marks.link, attrs)(state, dispatch);
  };
}
