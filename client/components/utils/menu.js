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

function markExtend($start, mark) {
  let startIndex = $start.index();
  let endIndex = $start.indexAfter();

  while (startIndex > 0 && mark.isInSet($start.parent.child(startIndex - 1).marks)) startIndex -= 1;
  while (
    endIndex < $start.parent.childCount &&
    mark.isInSet($start.parent.child(endIndex).marks)) endIndex += 1;
  let startPos = $start.start();
  let endPos = startPos;

  for (let i = 0; i < endIndex; i += 1) {
    const size = $start.parent.child(i).nodeSize;
    if (i < startIndex) startPos += size;
    endPos += size;
  }
  return {from: startPos, to: endPos};
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

      let hasLink = false;

      if (attr && attr.link) {
        const newNode = state.doc.nodeAt(selection.from);
        hasLink =
          newNode &&
          newNode.marks.length &&
          newNode.marks[0] &&
          newNode.marks[0].attrs &&
          newNode.marks[0].attrs.href;

        if (hasLink) {
          const linkFullPosition = markExtend(selection.$from, newNode.marks[0]);
          vueInstance.selectedExistingLink = {position: linkFullPosition};
          vueInstance.link = newNode.marks[0].attrs.href;
        }
        else {
          vueInstance.selectedExistingLink = null;
          vueInstance.link = '';
        }
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
