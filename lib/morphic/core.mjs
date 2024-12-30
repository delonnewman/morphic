import { BaseError, BaseObject, Null } from './base.mjs';
import { inspect, objectOf } from './utils.mjs';

export class Morph extends BaseObject {
  static build(...args) {
    return UnboundMorph.new(this, args);
  }

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

  isBound() {
    return true;
  }

  isUnbound() { return !this.isBound() }

  bind(_parent) {
    return this;
  }

  observe(morph) {
    morph.observeWith(this);
    return this;
  }

  observeWith(...observers) {
    this.observers.push(...observers);
    console.debug('observing', this.toString(), 'with', this.observers);
    return this;
  }

  isObserved() { return this.observers.length > 0 }

  notifyObservers() {
    if (!this.isObserved()) return;

    console.debug('notifying observers', this.toString(), this.observers);
    this.observers.forEach((observer) => {
      observer.update(this);
    });
  }

  draw(fn = undefined) {
    try {
      if (fn) fn(this);
      console.debug('drawing', this.toString());
      let initializerExecuted = false;
      if (!this.isInitialized()) {
        this.initialize();
        initializerExecuted = true;
      }
      this.drawSelf();
      this.children.forEach((child) => { child.draw() });
      if (this.isInitialized()) this.notifyObservers();
      if (!this.isInitialized() && initializerExecuted) {
        this.#initialized = true;
      }
    } catch (error) {
      console.error(error);
      if (error instanceof Error) {
        this.drawFailure(error);
      } else {
        throw error;
      }
    }
  }

  drawFailure(error) {}

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
  draw() {  },
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
    return `#<${this.constructor.name}:0x${this.hexId} ${inspect(this.value)}>`;
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

class UnboundMorph extends Morph {
  #morphClass;
  #args;
  #children;
  constructor(morphClass, args) {
    super(NullMorph);
    this.#morphClass = morphClass;
    this.#args = args;
    this.#children = [];
  }

  isBound() {
    return false;
  }

  add(...children) {
    this.#children.push(...children);
    return this;
  }

  bind(parent) {
    const morph = this.#morphClass.new(parent, ...this.#args);
    console.debug('binding', this.toString(), 'to', parent.toString());
    this.#children.forEach((child) => {
      morph.add(child.bind(morph));
    });
    return morph;
  }

  draw() {
    throw new Error('cannot draw UnboundMorph');
  }

  toString() {
    return `#<${this.constructor.name} class=${this.#morphClass} arguments=${inspect(this.#args)} children=${inspect(this.#children)}>`;
  }
}
