import {Step, AddMarkStep, RemoveMarkStep} from 'prosemirror-transform';

// ::- Add a mark to all inline content between two positions.
export class AddHighlightStep extends AddMarkStep {
  // :: (number, number, Mark)
  constructor(from, to, mark) {
    super();
    this.from = from;
    this.to = to;
    this.mark = mark;
  }

  apply(doc) {
    const oldSlice = doc.slice(this.from, this.to);
    let hasHighlight = false;

    oldSlice.content.content.forEach((x) => {
      x.marks.forEach((y) => {
        if (y.type.name === 'highlight') {
          hasHighlight = true;
        }
      });
    });

    if (hasHighlight) {
      return {failed: true};
    }

    return super.apply(doc);
  }

  invert() {
    return new RemoveHighlightStep(this.from, this.to, this.mark); // eslint-disable-line no-use-before-define
  }

  map(mapping) {
    const from = mapping.mapResult(this.from, 1);
    const to = mapping.mapResult(this.to, -1);
    if (from.deleted && to.deleted || from.pos >= to.pos) return null; // eslint-disable-line no-mixed-operators
    return new AddHighlightStep(from.pos, to.pos, this.mark);
  }

  merge(other) {
    return super.merge(other);
  }

  toJSON() {
    return {
      stepType: 'addHighlight',
      mark: this.mark.toJSON(),
      from: this.from,
      to: this.to,
    };
  }

  static fromJSON(schema, json) {
    if (typeof json.from !== 'number' || typeof json.to !== 'number') {
      throw new RangeError("Invalid input for AddHighlightStep.fromJSON");
    }
    return new AddHighlightStep(json.from, json.to, schema.markFromJSON(json.mark));
  }
}

Step.jsonID('addHighlight', AddHighlightStep);

// ::- Remove a mark from all inline content between two positions.
export class RemoveHighlightStep extends RemoveMarkStep {
  // :: (number, number, Mark)
  constructor(from, to, mark) {
    super();
    this.from = from;
    this.to = to;
    this.mark = mark;
  }

  apply(doc) {
    return super.apply(doc);
  }

  invert() {
    return new AddHighlightStep(this.from, this.to, this.mark);
  }

  map(mapping) {
    const from = mapping.mapResult(this.from, 1);
    const to = mapping.mapResult(this.to, -1);
    if (from.deleted && to.deleted || from.pos >= to.pos) return null; // eslint-disable-line no-mixed-operators
    return new RemoveHighlightStep(from.pos, to.pos, this.mark);
  }

  merge(other) {
    return super.merge(other);
  }

  toJSON() {
    return {
      stepType: 'removeHighlight',
      mark: this.mark.toJSON(),
      from: this.from,
      to: this.to,
    };
  }

  static fromJSON(schema, json) {
    if (typeof json.from !== 'number' || typeof json.to !== 'number') {
      throw new RangeError("Invalid input for RemoveHighlightStep.fromJSON");
    }
    return new RemoveHighlightStep(json.from, json.to, schema.markFromJSON(json.mark));
  }
}

Step.jsonID('removeHighlight', RemoveHighlightStep);
