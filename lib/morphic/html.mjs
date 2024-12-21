import { BaseObject } from './base.mjs';

export class HTMLCode extends BaseObject {
  #code;
  constructor(code) {
    super();
    this.#code = code;
  }

  toHTML() {
    return `${this.#code}`;
  }

  display() {
    return this.toHTML();
  }
}
