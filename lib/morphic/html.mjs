import { BaseObject } from './base.mjs';
import { UnboundMorph } from './core.mjs';
import { HTMLCodeMorph } from './dom.mjs';

export class HTMLCode extends BaseObject {
  #code;
  constructor(code) {
    super();
    this.#code = code;
  }

  toHTML() {
    return `${this.#code}`;
  }

  morph(parent) {
    if (parent) {
      return HTMLCodeMorph.new(parent, this.toHTML());
    }

    return UnboundMorph.init(HTMLCodeMorph, this.toHTML());
  }
}
