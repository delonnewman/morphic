import { BaseObject } from './base.mjs';

export class Database extends BaseObject {
  #eavIndex;
  constructor() {
    this.#eavIndex = Object.create(null);
  }

  add(id, attribute, value) {
    this.#eavIndex ??= Object.create(null);

  }
}
