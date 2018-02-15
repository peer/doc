import {Plugin} from 'prosemirror-state';
import {Decoration, DecorationSet} from 'prosemirror-view';

export class State {
  constructor(edit, comm) {
    this.edit = edit;
    this.comm = comm;
  }
}

class Comment {
  constructor(text, id) {
    this.id = id;
    this.text = text;
  }
}

function deco(from, to, comment) {
  return Decoration.inline(from, to, {class: "comment"}, {comment});
}

class CommentState {
  constructor(version, decos, unsent) {
    this.version = version;
    this.decos = decos;
    this.unsent = unsent;
  }

  findComment(id) {
    const current = this.decos.find();
    for (let i = 0; i < current.length; i += 1) {
      if (current[i].spec.comment.id === id) {
        return current[i];
      }
    }
    return null;
  }

  commentsAt(pos) {
    return this.decos.find(pos, pos);
  }

  apply(tr) {
    const action = tr.getMeta(commentPlugin); // eslint-disable-line
    const actionType = action && action.type;
    if (!action && !tr.docChanged) {
      return this;
    }
    let base = this;
    if (actionType === "receive") {
      base = base.receive(action, tr.doc);
    }
    let {decos, unsent} = base;

    decos = decos.map(tr.mapping, tr.doc);
    if (actionType === "newComment") {
      decos = decos.add(tr.doc, [deco(action.from, action.to, action.comment)]);
      unsent = unsent.concat(action);
    }
    else if (actionType === "deleteComment") {
      decos = decos.remove([this.findComment(action.comment.id)]);
      unsent = unsent.concat(action);
    }
    return new CommentState(base.version, decos, unsent);
  }

  receive({version, events, sent}, doc) {
    let {decos: set} = this;
    for (let i = 0; i < events.length; i += 1) {
      const event = events[i];
      if (event.type === "delete") {
        const found = this.findComment(event.id);
        if (found) set = set.remove([found]);
      }
      else if (!this.findComment(event.id)) {
        // "create"
        set = set.add(doc, [deco(event.from, event.to, new Comment(event.text, event.id))]);
      }
    }
    return new CommentState(version, set, this.unsent.slice(sent));
  }

  unsentEvents() {
    const result = [];
    for (let i = 0; i < this.unsent.length; i += 1) {
      const action = this.unsent[i];
      if (action.type === "newComment") {
        const found = this.findComment(action.comment.id);
        if (found) {
          result.push({
            type: "create",
            id: action.comment.id,
            from: found.from,
            to: found.to,
            text: action.comment.text,
          });
        }
      }
      else {
        result.push({type: "delete", id: action.comment.id});
      }
    }
    return result;
  }

  static init(config) {
    const decos = config.comments.comments.map((c) => {
      return deco(c.from, c.to, new Comment(c.text, c.id));
    });
    return new CommentState(config.comments.version, DecorationSet.create(config.doc, decos), []);
  }
}

export const commentPlugin = new Plugin({
  state: {
    init: CommentState.init,
    apply(tr, prev) {
      return prev.apply(tr);
    },
  },
  props: {
    decorations(state) {
      return this.getState(state).decos;
    },
  },
});
