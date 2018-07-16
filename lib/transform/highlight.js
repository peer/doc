import {MarkType} from 'prosemirror-model';

import {Transform, ReplaceStep} from 'prosemirror-transform';
import {AddHighlightStep, RemoveHighlightStep} from './highlight_step';

// Add the given mark to the inline content between `from` and `to`.
Transform.prototype.addHighlightMark = function addHighlightMark(from, to, mark) {
  const removed = [];
  const added = [];
  let removing = null;
  let adding = null;

  this.doc.nodesBetween(from, to, (node, pos, parent) => {
    if (!node.isInline) return;
    const marks = node.marks;
    if (!mark.isInSet(marks) && parent.type.allowsMarkType(mark.type)) {
      const start = Math.max(pos, from);
      const end = Math.min(pos + node.nodeSize, to);
      const newSet = mark.addToSet(marks);

      for (let i = 0; i < marks.length; i += 1) {
        if (!marks[i].isInSet(newSet)) {
          if (removing && removing.to === start && removing.mark.eq(marks[i])) {
            removing.to = end;
          }
          else {
            removed.push(removing = new RemoveHighlightStep(start, end, marks[i]));
          }
        }
      }

      if (adding && adding.to === start) {
        adding.to = end;
      }
      else {
        added.push(adding = new AddHighlightStep(start, end, mark));
      }
    }
  });

  removed.forEach((s) => {
    this.step(s);
  });
  added.forEach((s) => {
    this.step(s);
  });
  return this;
};

// Remove marks from inline nodes between `from` and `to`. When `mark`
// is a single mark, remove precisely that mark. When it is a mark type,
// remove all marks of that type. When it is null, remove all marks of
// any type.
Transform.prototype.removeHighlightMark = function removeHighlightMark(from, to, mark = null) {
  const matched = [];
  let step = 0;
  this.doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isInline) return;
    step += 1;
    let toRemove = null;
    if (mark instanceof MarkType) {
      const found = mark.isInSet(node.marks);
      if (found) toRemove = [found];
    }
    else if (mark) {
      if (mark.isInSet(node.marks)) toRemove = [mark];
    }
    else {
      toRemove = node.marks;
    }
    if (toRemove && toRemove.length) {
      const end = Math.min(pos + node.nodeSize, to);
      for (let i = 0; i < toRemove.length; i += 1) {
        const style = toRemove[i];
        let found;
        for (let j = 0; j < matched.length; j += 1) {
          const m = matched[j];
          if (m.step === step - 1 && style.eq(matched[j].style)) found = m;
        }
        if (found) {
          found.to = end;
          found.step = step;
        }
        else {
          matched.push({style, from: Math.max(pos, from), to: end, step});
        }
      }
    }
  });
  matched.forEach((m) => {
    this.step(new RemoveHighlightStep(m.from, m.to, m.style));
  });
  return this;
};
