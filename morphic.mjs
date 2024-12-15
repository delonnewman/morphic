const DENO_CUSTOM_INSPECT_SYMBOL = Symbol.for("Deno.customInspect");
const NODE_CUSTOM_INSPECT_SYMBOL = Symbol.for('nodejs.util.inspect.custom');

const EMPTY_ARRAY = Object.freeze([]);

const Inspectable = {
  // Inspecting
  inspect() {
    return this.toString();
  },
  [DENO_CUSTOM_INSPECT_SYMBOL]() { return this.toString() },
  [NODE_CUSTOM_INSPECT_SYMBOL]() { return this.toString() },
};

class NotImplementedError extends Error {
  constructor(methodName) {
    super();
    this.name = 'NotImplementedError';
    this.message = `${methodName} must be implemented by subclasses`;
  }
}

const Hashable = {
  hashCode() {
    throw new NotImplementedError('hashCode');
  },

  isEqual(other) {
    if (typeof other.hashCode !== 'function') {
      return false;
    }

    return this.hashCode() === other.hashCode();
  },
};

const Equatable = {
  isIdentical(other) {
    return this === other;
  },

  isEqual(other) {
    return this.isIdentical(other);
  },

  isEquivalent(other) {
    return this.isIdentical(other);
  },

  isNotIdentical(other) { return !this.isIdentical(other) },
  isNotEqual(other) { return !this.isEqual(other) },
  isNotEquivalent(other) { return !this.isEquivalent(other) },
};

const Base = Object.assign({}, Inspectable, Equatable);

// Core extensions
Object.assign(Object.prototype, Equatable, {
  isNil() { return false },
  inspect() {
    return `{${Object.entries(this)
      .map(([name, value]) => `${name}: ${value.inspect()}`)
      .join(", ")}}`
  },
});

function hashCombine(seed, hash) {
    // a la boost, a la clojure
    seed ^= hash + 0x9e3779b9 + (seed << 6) + (seed >> 2)
    return seed
}

const MORPH_HASH_CODE_SYMBOL = Symbol.for('#Morphic.cachedHashCode');

Object.assign(Array.prototype, Equatable, Hashable, {
  inspect() {
    return `[${this.map((item) => item.inspect()).join(", ")}]`;
  },
  hashCode() {
    if (!this[MORPHIC_HASH_CODE_SYMBOL]) {
      this[MORPHIC_HASH_CODE_SYMBOL] = this.reduce((hash, item) => hashCombine(hash, item.hashCode()));
    }

    return this[MORPHIC_HASH_CODE_SYMBOL];
  },
  isEqual(other) {
    if (!(other instanceof Array)) return false;

    return this.hashCode() === other.hashCode();
  }
});

Object.assign(Date.prototype, Equatable, Hashable, {
  inspect() {
    return this.toString();
  },
  hashCode() {
    return this.valueOf();
  },
});

Object.assign(RegExp.prototype, Equatable, Hashable, {
  inspect() {
    return this.toString();
  }
});

Object.assign(Function.prototype, Equatable, {
  inspect() {
    return this.toString();
  }
});

function booleanNumberCompare(boolean, number) {
  return boolean ? number === 1 : number === 0;
}

Object.assign(Number.prototype, Equatable, Hashable, {
  inspect() {
    return this.toString();
  },
  hashCode() {
    return this;
  },
  isEqual(other) {
    return this === other;
  },
  isEquivalent(other) {
    if (this.isEqual(other)) return true;

    if (other == null) {
      return this === 0;
    }

    const type = typeof other;
    switch(type) {
      case 'string':
        return this.toString() === other;
      case 'boolean':
        return booleanNumberCompare(other, this);
    }

    return false;
  },
});

function booleanStringCompare(boolean, string) {
  const lower = string.toLowerCase()
  return boolean
    ? lower === 'yes' || lower === '1' || lower === 'true'
    : lower === 'no' || lower === '0' || lower === 'false';
}

Object.assign(Boolean.prototype, Equatable, Hashable, {
  inspect() {
    return this ? "Yes" : "No";
  },
  hashCode() {
    return this ? 1 : 0;
  },
  isEqual(other) {
    return this === other;
  },
  isEquivalent(other) {
    if (this.isEqual(other)) return true;

    if (other == null) {
      return this ? false : true;
    }

    const type = typeof other;
    switch(type) {
      case 'number':
        return booleanNumberCompare(this, other);
      case 'string':
        return booleanStringCompare(this, other);
    }

    return false;
  }
});

// A basic string hash
function stringHash(str) {
  let code = 0;
  for (let i = 0; i < str.length; i++) {
    for (let j = str.length; j > 0; j--) {
      code += Math.pow(str.charCodeAt(i), j)
    }
  }
  return code;
}

Object.assign(String.prototype, Equatable, Hashable, {
  inspect() {
    return `"${this}"`;
  },
  hashCode() {
    return stringHash(this);
  },
  isEqual(other) {
    if (typeof other !== 'string') return false;

    return this === other;
  },
  isEquivalent(other) {
    if (this === `${other}`) return true;

    if (typeof other === 'boolean') {
      return booleanStringCompare(other, this);
    }

    return false;
  }
});

// A default Null object
const NilBase = function(){};
Object.assign(NilBase, Base);
Object.assign(NilBase, {
  inspect() { return '-' },
  toString() { return 'nil' },
  valueOf() { return undefined },
  isNil() { return true },
});

const NilHandler = {
  get(nil, property, receiver) {
    if (Object.hasOwn(nil, property)) {
      return Reflect.get(nil, property);
    }

    return Nil;
  },
  has(_target, _key) {
    return true;
  },
  apply(_target, _this, _args) {
    return Nil;
  },
}

export const Nil = new Proxy(NilBase, NilHandler);

// object coersion
function objectOf(value) {
  if (value == null) return Nil;

  return value;
}

export class MorphFactory {
  static registry = [];
  static register(constructor, predicate) {
    this.registry.unshift({
      predicate,
      constructor,
    });
  }

  buildFor(value) {
    const registry = this.constructor.registry;

    for (const { predicate, constructor } of registry) {
      if (predicate(value)) {
        return new constructor(value);
      }
    }

    throw new Error(`Don't know how to make a morph for ${value.inspect()}`);
  }
}

export const nextID = (() => {
  let currentID = 0;
  return () => {
    return currentID++;
  }
})();

export class Morph {
  static {
    Object.assign(this, Base);
  }

  static #factory = undefined;
  static factory() {
    return (this.#factory ??= new MorphFactory());
  }

  static of(value) {
    if (value instanceof Morph) {
      return value;
    }

    return this.factory().buildFor(objectOf(value));
  }

  #morphId;
  #parent;
  #initialized;
  #firstDraw;

  constructor(parent) {
    this.#morphId = nextID();
    this.#parent = parent;
    this.#initialized = false;
    this.#firstDraw = false;
  }

  get parent() { return this.#parent; }
  get morphId() { return this.#morphId; }

  draw() {
    console.log('drawing', this.toString());
    if (!this.isInitialized()) {
      this.initialize();
      this.#initialized = true;
      this.#firstDraw = true;
    } else {
      this.#firstDraw = false;
    }
    this.drawSelf();
    this.children.forEach((child) => {
        child.draw();
    });
  }

  get children() {
    throw new NotImplementedError('children');
  }

  drawSelf() {
    throw new NotImplementedError('drawSelf');
  }

  redraw(child) {
    child.draw();
  }

  initialize() {}
  isInitialized() { return this.#initialized }
  isFirstDraw() { return this.#firstDraw }

  isIdentical(other) {
    return this.morphId === other.morphId;
  }

  inspect() { return this.toString() }

  toString() {
    return `#<${this.constructor.name}:0x${this.hexId}>`;
  }

  get hexId() {
    return `${this.morphId.toString(16).padStart(4, "0")}`;
  }
}

export class NullMorph extends Morph {
  constructor() {
    super(Nil);
  }

  get element() { return Nil }
  get children() { return EMPTY_ARRAY }
  drawSelf() {  }
}

export class AtomicMorph extends Morph {
  #value;
  #observers;
  #originalValue;

  constructor(parent, initialValue) {
    super(parent);
    this.#value = initialValue;
    this.#observers = [];
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
      this.#observers.forEach((observer) => {
        observer.update(this, oldValue);
      });
    }
  }

  reset() {
    this.value = this.#originalValue;
    return this;
  }

  observeWith(...observers) {
    this.#observers.push(...observers);
    return this;
  }

  swap(fn) {
    this.value = fn(this.value);
    return this;
  }
}

export class TextNodeMorph extends AtomicMorph {
  #node;

  constructor(parent, text) {
    super(parent, text);
  }

  get node() { return this.#node }
  get children() { return EMPTY_ARRAY }

  initialize() {
    this.#node = document.createTextNode(this.value);
    this.parent.element.append(this.#node);
  }

  drawSelf() {
    this.node.nodeValue = this.value;
  }
}

export class HTMLClassListMorph extends Morph {
  #classes;

  constructor(parent, classes) {
    super(parent);
    this.#classes = classes;
  }

  get element() { return this.parent.parent.element }

  remove(className) {
    const classes = [ ...this.#classes ];
    const index = classes.indexOf(className);
    delete classes[index];
    this.#classes = classes;
    this.parent.redraw(this);
  }

  add(className) {
    const classes = [ ...this.#classes, className ];
    this.#classes = classes;
    this.parent.redraw(this);
  }

  initialize() {
    this.drawSelf();
  }

  get children() { return EMPTY_ARRAY }

  drawSelf() {
    if (this.#classes.length === 0) return;

    const tokens = this.element.classList.keys()
    tokens.forEach((key) => {
      this.element.classList.remove(key);
    });

    this.element.classList.add(...this.#classes);
  }

  inspect() {
    return `"${this.#classes.join(' ')}"`
  }
}

export class HTMLAttributeMorph extends Morph {
  #name;
  #value;

  constructor(parent, name, value) {
    super(parent);
    this.#name = name;
    this.#value = value;
  }

  get element() { return this.parent.parent.element }

  get name() { return this.#name }
  get value() { return this.#value }
  set value(newValue) {
    this.#value = newValue;
    this.parent.redraw(this);
  }

  initialize() {
    this.drawSelf();
  }

  get children() { return EMPTY_ARRAY }

  drawSelf() {
    this.element.setAttribute(this.name, this.value);
  }

  inspect() {
    return `${this.name}=${this.value.inspect()}`
  }

  toString() {
    return `#<${this.constructor.name}:${this.hexId} ${this.inspect()}>`
  }
}

export class HTMLAttributeListMorph extends Morph {
  #attributes;
  #classList;
  #children;

  constructor(parent, attributes) {
    super(parent)
    attributes = { ...attributes, id: this.parent.elementId };
    this.#attributes =
      Object.entries(attributes)
            .map(([name, value]) => new HTMLAttributeMorph(this, name, value))
            .reduce((mapping, morph) => ({ ...mapping, [morph.name]: morph }), {});

    this.#children = Object.values(this.#attributes);

    let classList = attributes.class ?? [];
    delete attributes.class;
    if (typeof classList === "string") this.#classList = classList.split(" ");
    this.#classList = new HTMLClassListMorph(this, classList);
    this.#children.push(this.#classList);
  }

  get classList() { return this.#classList }
  get children() { return this.#children }

  update(name, value) {
    this.#attributes[name].value = value;
    this.parent.redraw(this);
  }

  drawSelf() { }

  inspect() {
    return Object.values(this.#attributes).map((it) => it.inspect()).join(' ');
  }

  toString() {
    return `#<${this.constructor.name}:${this.hexId} ${this.inspect()}>`
  }
}

export class HTMLElementMorph extends Morph {
  #tagName;
  #attributes;
  #children;
  #eventObservers;
  #element;

  constructor(parent, tagName, attributes = {}, children = []) {
    super(parent);
    this.#tagName = tagName;
    this.#attributes = new HTMLAttributeListMorph(this, { ...attributes, id: this.elementId });
    this.#children = [ ...children ];
    this.#eventObservers = {};
  }

  get tagName() { return this.#tagName }
  get attributes() { return this.#attributes }
  get children() { return this.#children }
  get element() { return this.#element }
  get node() { return this.element }

  get elementId() {
    return `morphic-${this.hexId}`;
  }

  get events() { return Object.keys(this.#eventObservers) }

  toString() {
    return `#<${this.constructor.name}:0x${this.hexId} ${this.tagName} ${this.attributes.inspect()} ${this.children.inspect()}>`;
  }

  observeEvent(event, ...observers) {
    this.#eventObservers[event] ??= [];
    this.#eventObservers[event].push(...observers);
    if (this.isInitialized()) {
      this.#enableObservers(event, observers);
    }
    return this;
  }

  addChild(morphClass, ...args) {
    const morph = new morphClass(this, ...args);
    this.children.push(morph)
    if (this.isInitialized()) { this.parent.redraw(this) }
    return morph;
  }

  createElement(tagName, attributes = {}, children = []) {
    return this.addChild(HTMLElementMorph, tagName, attributes, children);
  }

  withText(text) {
    const morph = new TextNodeMorph(this, text);
    this.children.push(morph);
    if (this.isInitialized()) { this.parent.redraw(this) }
    return this;
  }

  withElement(...args) {
    this.createElement(...args);
    return this;
  }

  dontFollowThrough() {
    return this.tagName === 'a';
  }

  initialize() {
    const element = this.#element = document.createElement(this.tagName);
    this.#enableAllObservers();

    this.parent.element.append(element);
  }

  drawSelf() {
    console.log('drawing self', this.toString(), this.#element);
    this.#attributes.draw();
  }

  #enableAllObservers() {
    this.events.forEach((eventName) => {
      const observers = this.#eventObservers[eventName];
      this.#enableObservers(eventName, observers);
    });
  }

  #enableObservers(eventName, observers) {
    observers.forEach((observer) => {
      this.#element.addEventListener(eventName, this.#listenerForObserver(observer));
    });
  }

  #listenerForObserver(observer) {
    return (event) => {
      observer.update(this, event);
      if (this.dontFollowThrough()) {
        event.preventDefault();
      }
    }
  }
}

export class HTMLDocumentMorph extends HTMLElementMorph {
  constructor() {
    super(new NullMorph(), 'document');
  }

  draw() { }
  get element() { return document }
}

export class HTMLDocumentBodyMorph extends HTMLElementMorph {
  constructor(attributes = {}, children = []) {
    super(new HTMLDocumentMorph(), 'body', attributes, children);
  }

  isInitialized() { return true }
  get element() { return document.body }
}

export class FAIconMorph extends HTMLElementMorph {
  #name;

  constructor(parent, name) {
    super(parent, 'i', { class: ['fa', `fa-${name}`] });
    this.#name = name;
  }
}
