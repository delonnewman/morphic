const DENO_CUSTOM_INSPECT_SYMBOL = Symbol.for("Deno.customInspect");
const NODE_CUSTOM_INSPECT_SYMBOL = Symbol.for('nodejs.util.inspect.custom');

const EMPTY_ARRAY = Object.freeze([]);

const Inspectable = {
  // technical detailed display
  inspect() {
    return this.toString();
  },
  // user display (may be evaluated in an HTML context)
  display() {
    return this.inspect();
  },
  [DENO_CUSTOM_INSPECT_SYMBOL]() { return this.inspect() },
  [NODE_CUSTOM_INSPECT_SYMBOL]() { return this.inspect() },
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

// Mixins & object extension
Object.assign(Object.prototype, {
  extend(...mixins) {
    mixins.forEach((mixin) => {
      Object.assign(this, mixin);
    });
    return this;
  },
});

const Base = {
  hasProperty(property) {
    return Reflect.has(this, property);
  },

  hasMethod(method) {
    return this.has(method) && typeof Reflect.get(this, method) === 'function';
  },

  getAllPropertyNames() {
    const names = [];
    for (let name in this) { names.push(name) }
    return names;
  },

  freeze() {
    return Object.freeze(this);
  },

  morph(parent) {
    return new ObjectMorph(parent, this);
  }
};
Base.extend(Inspectable, Equatable);

export class BaseObject {
  static include(...mixins) {
    this.prototype.extend(...mixins);
    return this;
  }

  static {
    this.include(Base);
    this.extend(Base);
  }
}

// Core extensions
Object.prototype.extend(Base, {
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

Array.prototype.extend(Equatable, Hashable, Inspectable, {
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

Date.prototype.extend(Equatable, Hashable, Inspectable, {
  inspect() {
    return this.toString();
  },

  hashCode() {
    return this.valueOf();
  },
});

RegExp.prototype.extend(Equatable, Hashable, Inspectable, {
  inspect() {
    return this.toString();
  }
});

Function.prototype.extend(Equatable, Inspectable, {
  inspect() {
    return this.toString();
  }
});

function booleanNumberCompare(boolean, number) {
  return boolean ? number === 1 : number === 0;
}

Number.prototype.extend(Equatable, Hashable, Inspectable, {
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

Boolean.prototype.extend(Equatable, Hashable, Inspectable, {
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

String.prototype.extend(Equatable, Hashable, Inspectable, {
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
NilBase.extend(Base, {
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

  return Object(value);
}

export const nextID = (() => {
  let currentID = 0;
  return () => {
    return currentID++;
  }
})();

export class Morph extends BaseObject {
  #morphId;
  #parent;
  #initialized;
  #firstDraw;
  constructor(parent) {
    super();
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

  morph() {
    return this;
  }
}

export const NilMorph = {
  get parent() { return Nil },
  get element() { return Nil },
  get children() { return EMPTY_ARRAY },
  drawSelf() {  },
};
Object.setPrototypeOf(NilMorph, Morph.prototype);

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

    const tokens = this.element.classList;
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
    super(NilMorph, 'document');
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

export class HTML2DCanvasMorph extends HTMLElementMorph {
  #context;
  constructor(parent, attributes, children) {
    super(parent, 'canvas', attributes, children);
  }

  get context() { return this.#context }

  initialize() {
    super.initialize();
    this.#context = this.element.getContext('2d');
  }
}

export class CanvasChildMorph extends Morph {
  get context() { return this.parent.context }
  get children() { return EMPTY_ARRAY } // for now default to no children
}

export class ValueObject extends BaseObject {
  static {
    this.include(Hashable);
  }

  isEqual(other) {
    if (!(other instanceof this.constructor)) return false;

    return this.hashCode() === other.hashCode();
  }

  toString() {
    return `#<${this.constructor.name}:${this.hashCode()}>`;
  }
}

export class Position extends ValueObject {


  #x;
  #y;
  constructor(x, y) {
    super();
    this.#x = x;
    this.#y = y;
  }

  get x() { return this.#x }
  get y() { return this.#y }

  hashCode() {
    return hashCombine(this.#x.hashCode(), this.#y.hashCode());
  }

  isEqual(other) {
    if (!(other instanceof Position)) return false;

    return this.x.isEqual(other.x) && this.y.isEqual(other.y);
  }

  right(amount) {
    return new Position(this.x + amount, this.y);
  }

  left(amount) {
    return new Position(this.x - amount, this.y);
  }

  up(amount) {
    return new Position(this.x, this.y - amount);
  }

  down(amount) {
    return new Position(this.x, this.y + amount);
  }

  inspect() {
    return `(${this.x}, ${this.y})`;
  }

  toString() {
    return `#<${this.constructor.name}:${this.hashCode()} ${this.inspect()}>`;
  }
}

export class Shape extends ValueObject {
  static defaultStyle() {
    return new FillStyle('black');
  }

  #position;
  constructor(position) {
    super();
    this.#position = position;
  }

  get position() { return this.#position }

  morph(parent, style = this.constructor.defaultStyle()) {
    return new CanvasShapeMorph(parent, this, style);
  }

  right(amount) {
    return this.withPosition(this.position.right(amount));
  }

  left(amount) {
    return this.withPosition(this.position.left(amount));
  }

  up(amount) {
    return this.withPosition(this.position.up(amount));
  }

  down(amount) {
    return this.withPosition(this.position.down(amount));
  }

  withPosition(position, ...args) {
    return new this.constructor(position, ...args);
  }

  toString() {
    return `#<${this.constructor.name}:${this.hashCode()} @ ${this.position.inspect()}>`;
  }
}

export class Rectangle extends Shape {
  static defaultStyle() {
    return new FillStyle('red');
  }

  #width;
  #height;
  constructor(position, width, height) {
    super(position);
    this.#width = width;
    this.#height = height;
  }

  get width() { return this.#width }
  get height() { return this.#height }

  draw(context) {
    context.rect(this.position.x, this.position.y, this.width, this.height);
    return this;
  }
}

export class Circle extends Shape {
  static defaultStyle() {
    return new StrokeStyle('blue', 10);
  }

  #radius;
  constructor(position, radius) {
    super(position);
    this.#radius = radius;
  }

  get radius() { return this.#radius }

  draw(context) {
    context.arc(this.position.x, this.position.y, this.radius, 0, 2 * Math.PI);
  }
}

export class Style extends ValueObject {
  draw(context) {
    throw new NotImplementError('draw');
  }
}

export class FillColor extends Style {
  #color;
  constructor(color) {
    super();
    this.#color = color;
  }

  get color() { return this.#color }

  hashCode() {
    return this.color.hashCode();
  }

  draw(context) {
    context.fillStyle = this.color;
    context.fill();
  }

  toString() {
    return `#<${this.constructor.name}:${this.hashCode()} color=${this.color}>`;
  }
}

export class StrokeColor extends Style {
  #color;
  constructor(color) {
    super();
    this.#color = color;
  }

  get color() { return this.#color }

  hashCode() {
    return this.color.hashCode();
  }

  draw(context) {
    context.strokeStyle = this.color;
    context.stroke()
  }

  toString() {
    return `#<${this.constructor.name}:${this.hashCode()} ${this.color}>`;
  }
}

export class StrokeWidth extends Style {
  #width;
  constructor(width) {
    super();
    this.#width = width;
  }

  get width() { return this.#width }

  hashCode() {
    return this.width.hashCode();
  }

  draw(context) {
    context.lineWith = this.width;
    context.stroke()
  }

  toString() {
    return `#<${this.constructor.name}:${this.hashCode()} ${this.width}>`;
  }
}

export class StyleCombination extends Style {
  #styles;
  constructor(...styles) {
    super()
    this.#styles = styles;
  }

  hashCode() {
    this.#styles.hashCode();
  }

  draw(context) {
    this.#styles.forEach((style) => { style.draw(context) })
  }
}

export class CanvasShapeMorph extends CanvasChildMorph {
  #shape;
  #style;
  constructor(parent, shape, style) {
    super(parent);
    this.#shape = shape;
    this.#style = style;
  }

  get shape() { return this.#shape }
  set shape(shape) {
    this.#shape = shape
    this.parent.redraw(this);
    this.drawSelf();
  }

  get style() { return this.#style }
  set style(style) {
    this.#style = style;
    this.parent.redraw(this)
  }

  moveRight(amount) {
    this.shape = this.shape.right(amount);
  }

  moveLeft(amount) {
    this.shape = this.shape.left(amount);
  }

  moveUp(amount) {
    this.shape = this.shape.up(amount);
  }

  moveDown(amount) {
    this.shape = this.shape.down(amount);
  }

  drawSelf() {
    this.context.beginPath();
    this.#shape.draw(this.context);
    this.#style.draw(this.context);
  }
}
