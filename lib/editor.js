import {EJSON} from 'meteor/ejson';

import {Step} from 'prosemirror-transform';
import {peerDocSchema} from '/lib/schema';

Step.prototype.toJSONValue = function toJSONValue() {
  return this.toJSON();
};

Step.prototype.typeName = function typeName() {
  return 'ProseMirror/Step';
};

EJSON.addType('ProseMirror/Step', function fromJSONValue(json) {
  return Step.fromJSON(peerDocSchema, json);
});
