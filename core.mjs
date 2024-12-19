import { BaseObject, objectOf, Null } from './base.mjs';

export class Morph extends BaseObject {
  #parent;
  #initialized;
  #observers;
  constructor(parent) {
    super();
    this.#parent = parent;
    this.#initialized = false;
    this.#observers = [];
  }

  get parent() { return this.#parent; }
  get morphId() { return this.objectId; }
  get observers() { return this.#observers; }

  update(morph, ..._args) { }

  observe(morph) {
    morph.observeWith(this);
    return this;
  }

  observeWith(...observers) {
    this.observers.push(...observers);
    console.log('observing', this.toString(), 'with', this.observers);
    return this;
  }

  isObserved() { return this.observers.length > 0 }

  notifyObservers() {
    if (!this.isObserved()) return;

    console.log('notifying observers', this.toString(), this.observers);
    this.observers.forEach((observer) => {
      observer.update(this);
    });
  }

  draw() {
    console.log('drawing', this.toString());
    if (!this.isInitialized()) {
      this.initialize();
      this.#initialized = true;
    }
    this.drawSelf();
    this.children.forEach((child) => {
        child.draw();
    });
    this.notifyObservers();
  }

  get children() {
    this.subclassShouldImplement('children');
  }

  drawSelf() {
    this.subclassShouldImplement('drawSelf');
  }

  redraw(child) {
    child.draw();
  }

  initialize() {}
  isInitialized() { return this.#initialized }

  morph() {
    return this;
  }
}

export const NullMorph = {
  get parent() { return NullMorph },
  get element() { return Null },
  get children() { return EMPTY_ARRAY },
  drawSelf() {  },
  toString() { return '#<NullMorph>' },
  isNull() { return true }
};
Object.setPrototypeOf(NullMorph, Morph.prototype);

export class AtomicMorph extends Morph {
  #value;
  #originalValue;
  constructor(parent, initialValue) {
    super(parent);
    this.#value = initialValue;
  }

  valueOf() {
    return this.#value;
  }

  toString() {
    return `#<${this.constructor.name}:0x${this.hexId} ${this.value.inspect()}>`;
  }

  get value() {
    return this.#value;
  }

  set value(newValue) {
    const object = objectOf(newValue)
    if (this.#value.isNotEqual(object)) {
      const oldValue = this.#value;
      this.#value = object;
      this.parent.redraw(this);
    }
  }

  reset() {
    this.value = this.#originalValue;
    return this;
  }

  swap(fn) {
    this.value = fn(this.value);
    return this;
  }
}
