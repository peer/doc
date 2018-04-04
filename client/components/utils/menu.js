import Vue from 'vue';
import {wrapIn, lift, setBlockType} from "prosemirror-commands";
import {wrapInList} from "prosemirror-schema-list";
import {Plugin} from "prosemirror-state";

export function hasMark(state, markType) {
  const {from, $from, to, empty} = state.selection;
  if (empty) {
    return markType.isInSet(state.storedMarks || $from.marks());
  }
  else {
    return state.doc.rangeHasMark(from, to, markType);
  }
}

export function isMarkActive(markType) {
  return function isActive(state) {
    return !!hasMark(state, markType);
  };
}

function harMarkup(state, markup, attr) {
  for (let i = 0; i < state.selection.$from.path.length; i += 1) {
    if (typeof state.selection.$from.path[i] !== 'number' && state.selection.$from.path[i].hasMarkup(markup, attr)) {
      return true;
    }
  }
  return false;
}

export function toggleHeading(level) {
  return function onToggle(state, dispatch, editorView) {
    if (harMarkup(state, state.schema.nodes.heading, {level})) {
      return setBlockType(state.schema.nodes.paragraph)(state, dispatch);
    }
    else {
      return setBlockType(state.schema.nodes.heading, {level})(state, dispatch);
    }
  };
}

export function isHeadingActive(level) {
  return function isActive(state) {
    return harMarkup(state, state.schema.nodes.heading, {level});
  };
}

export function toggleBlockquote() {
  return function onToggle(state, dispatch, editorView) {
    if (harMarkup(state, state.schema.nodes.blockquote)) {
      return lift(state, dispatch);
    }
    else {
      return wrapIn(state.schema.nodes.blockquote)(state, dispatch);
    }
  };
}

export function isBlockquoteActive() {
  return function isActive(state) {
    return harMarkup(state, state.schema.nodes.blockquote);
  };
}

export function toggleList(listType) {
  return function onToggle(state, dispatch, editorView) {
    if (harMarkup(state, listType)) {
      return lift(state, dispatch);
    }
    else {
      return wrapInList(listType)(state, dispatch);
    }
  };
}

export function isListActive(listType) {
  return function isActive(state) {
    return harMarkup(state, listType);
  };
}

class MenuView {
  constructor(items, editorView, disabledButtons) {
    this.items = items;
    this.editorView = editorView;
    this.disabledButtons = disabledButtons;

    this.update();

    this.listeners = this.items.map((item) => {
      const {node} = item;
      const listener = this.onMenuItemClick.bind(this, item);
      node.$on('click', listener);
      return listener;
    });
  }

  onMenuItemClick({command}, event) {
    event.preventDefault();
    this.editorView.focus();
    command(this.editorView.state, this.editorView.dispatch, this.editorView);
  }

  update(view, prevState) {
    this.items.forEach(({command, name, isActive, node}) => {
      Vue.set(this.disabledButtons, name, !command(this.editorView.state, null, this.editorView));
      // Setting "isActive" triggers "input" event on the button.
      node.isActive = isActive ? !!isActive(this.editorView.state) : false; // eslint-disable-line no-param-reassign
    });
  }

  destroy() {
    this.items.forEach(({node}, i) => {
      node.$off('click', this.listeners[i]);
    });
  }
}

export function menuPlugin(items, disabledButtons) {
  return new Plugin({
    view(editorView) {
      return new MenuView(items, editorView, disabledButtons);
    },
  });
}
