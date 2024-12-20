const DENO_CUSTOM_INSPECT_SYMBOL = Symbol.for("Deno.customInspect");
const NODE_CUSTOM_INSPECT_SYMBOL = Symbol.for('nodejs.util.inspect.custom');

export const EMPTY_ARRAY = Object.freeze([]);
export const EMPTY_MAP = Object.freeze(new Map());
export const EMPTY_SET = Object.freeze(new Set());

// Mixins & object extension
Object.assign(Object.prototype, {
  extend(...mixins) {
    mixins.forEach((mixin) => {
      Object.assign(this, mixin);
    });
    return this;
  },
});

export const Inspectable = {
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

export class NotImplementedError extends Error {
  constructor(methodName) {
    super(`${methodName ?? 'method'} must be implemented by subclasses`);
    this.name = 'NotImplementedError';
  }
}

export class ArgumentError extends Error {
  constructor(given, expected) {
    super(`wrong number of arguments given ${given} expected ${expected}`);
    this.name = 'ArgumentError';
  }
}

export const Hashable = {
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

export const Equatable = {
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

export const Associative = {
  fetch(key, ...args) {
    const value = this.get(index);
    if (value !== undefined) return value;

    if (args.length === 0) {
      throw new Error(`missing index ${index}`);
    }

    return args[0];
  },

  dig(...keys) {
    const value = this.fetch(keys[0], Null);
    if (value.isNull()) return value;
    if (keys.length === 1) {
      return value;
    }

    return value.dig(...keys.drop(1));
  },

  has(key) {
    return !!this.get(key);
  },

  valuesAt(...keys) {
    const values = [];
    for (const key of keys) {
      values.push(this.get(key) ?? Null);
    }
    return values;
  },
};

export class Mirror {
  static {
    this.prototype.extend(Inspectable);
  }

  #subject;
  constructor(subject) {
    this.#subject = subject;
  }

  get subject() { return this.#subject }

  has(property) {
    return Reflect.has(this.#subject, property);
  }

  get(property) {
    return Reflect.get(this.#subject, property)
  }

  respondsTo(method) {
    return typeof this.getPropertyDescriptor(method).value === 'function';
  }

  isMethod(property) {
    return this.respondsTo(property);
  }

  isProperty(property) {
    return this.has(property) && !this.isMethod(property);
  }

  getOwnPropertyNames() {
    return Object.getOwnPropertyNames(this.#subject);
  }

  getOwnPropertyDescriptor(property) {
    return Object.getOwnPropertyDescriptor(this.#subject, property);
  }

  getPrototype() {
    return Object.getPrototypeOf(this.#subject);
  }

  getPropertyDescriptor(property) {
    const descriptor = this.getOwnPropertyDescriptor(property);
    if (descriptor !== undefined) return descriptor;

    const prototype = this.getPrototype();
    if (prototype == null) return undefined;

    return prototype.mirror.getPropertyDescriptor(property);
  }

  getOwnMethodNames() {
    return this.getOwnPropertyNames()
               .filter((name) => this.respondsTo(name));
  }

  getPropertyNames() {
    const names = [];
    for (const name in this) { names.push(name) }
    return names;
  }

  getMethodNames() {
    return this.getPropertyNames()
               .filter((name) => typeof this[name] === 'function');
  }

  method(method) {
    if (!this.isMethod(method)) {
      throw new Error(`unknown method ${method}`);
    }
    return this.subject[method].bind(this.subject);
  }

  defineProperty(property, descriptor) {
    Object.defineProperty(this.subject, property, descriptor);
    return this;
  }

  defineMethod(property, fn) {
    if (typeof fn !== 'function') {
      throw new Error('a function is required to define a method');
    }
    return this.defineProperty(property, { value: fn });
  }

  toString() {
    return `#<${this.constructor.name} ${this.subject}>`;
  }
}

export class ClassMirror extends Mirror {
  isInstanceMethod(property) {
    return this.subject.prototype.mirror.isMethod(property);
  }

  isInstanceProperty(property) {
    return this.subject.prototype.mirror.isProperty(property);
  }

  instanceMethod(method) {
    if (!this.isInstanceMethod(method)) {
      throw new Error(`unknown instance method ${method}`);
    }
    return this.prototype[method];
  }
}

export const Base = {
  freeze() {
    return Object.freeze(this);
  },

  morph() {
    return NullMorph;
  },
};
Base.extend(Inspectable, Equatable);

export const genObjectId = (() => {
  let currentId = 1;
  return () => {
    return currentId++;
  }
})();

export class BaseObject {
  static include(...mixins) {
    this.prototype.extend(...mixins);
    return this;
  }

  static {
    this.include(Base);
    this.extend(Base);
  }

  static toString() {
    return `#<Class ${this.name}>`;
  }

  static get mirror() {
    return this[Symbol.for('morphic.mirror')] ??= new ClassMirror(this);
  }

  static new(...args) {
    if (args.length < this.length) {
      throw new ArgumentError(args.length, this.length);
    }
    return new this(...args);
  }

  static allocate() {
    return new this();
  }

  static of(entries) {
    const properties = ['objectId', ...Object.getOwnPropertyNames(this.prototype)];
    const object = this.allocate();
    for (const [property, value] of entries.toArray()) {
      if (properties.includes(property) && this.mirror.isInstanceProperty(property)) {
        console.log(property, value);
        this.eval(`object.#${property} = value`);
      }
    }
    return object;
  }

  #objectId;
  constructor() {
    this.#objectId = genObjectId();
  }

  get objectId() { return this.#objectId }

  isIdentical(other) {
    return this.objectId = other.objectId;
  }

  get hexId() {
    return `${this.objectId.toString(16).padStart(4, "0")}`;
  }

  toString() {
    return `#<${this.constructor.name}:0x${this.hexId}>`;
  }

  subclassShouldImplement(methodName = undefined) {
    throw new NotImplementedError(methodName);
  }

  isa(klass) {
    // TODO: should leave a paper trail for mixins so they can be included here also
    return this.instanceOf(klass);
  }

  instanceOf(klass) {
    if (!(typeof klass === 'function')) {
      return false;
    }

    return this instanceof klass;
  }

  constructedBy(constructor) {
    return this.constructor === constructor;
  }

  toData() {
    const data = new Map([['objectId', this.objectId], ['className', this.constructor.name]]);
    const keys = Object.getOwnPropertyNames(this.constructor.prototype);
    for (const key of keys) {
      const value = this[key];
      if (typeof value !== 'function') {
        data.set(key, value.toData());
      }
    }
    return Object.freeze(data);
  }

  get mirror() {
    return this[Symbol.for('morphic.mirror')] ??= new Mirror(this);
  }
}

export class ValueObject extends BaseObject {
  static {
    this.include(Hashable);
  }

  isEqual(other) {
    if (!this.instanceOf(this.constructor)) {
      return false;
    }

    return this.hashCode() === other.hashCode();
  }

  toString() {
    return `#<${this.constructor.name}:${this.hashCode()}>`;
  }
}

// Core extensions
Object.prototype.extend(Base, {
  isNull() { return false },

  inspect() {
    return `{${Object.entries(this)
      .map(([name, value]) => `${name}: ${value.inspect()}`)
      .join(", ")}}`
  },

  get mirror() {
    return this[Symbol.for('morphic.mirror')] ??= new Mirror(this);
  },
});

Error.prototype.extend({
  display() {
    return `${this.constructor.name}: ${this.message}: ${this.stack}`;
  }
});

function hashCombine(seed, hash) {
    // a la boost, a la clojure
    seed ^= hash + 0x9e3779b9 + (seed << 6) + (seed >> 2)
    return seed
}

// TODO: use this technique for extension methods https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object#instance_methods
Array.prototype.extend(Equatable, Hashable, Inspectable, Associative, {
  inspect() {
    return `[${this.map((item) => item.inspect()).join(", ")}]`;
  },

  isEmpty() {
    return this.length === 0;
  },

  toData() {
    if (this.isEmpty()) {
      return EMPTY_ARRAY;
    }

    const copy = this.map((it) => it.toData());
    return Object.freeze(copy);
  },

  drop(count) {
    return this.slice(count, this.length);
  },

  get(index) {
    return this.at(index);
  },

  set(index, value) {
    this[index] = value;
  },

  hashCode() {
      return this.reduce((hash, item) => hashCombine(hash, item.hashCode()));
  },

  isEqual(other) {
    if (!(other instanceof Array)) return false;

    return this.hashCode() === other.hashCode();
  },

  toArray() {
    return this;
  },

  toMap() {
    return new Map(this);
  },

  toSet() {
    return new Set(this);
  },
});

Map.prototype.extend(Equatable, Hashable, Inspectable, Associative, {
  toData() {
    if (this.isEmpty()) {
      return EMPTY_MAP;
    }

    return Object.freeze(this.transform((value) => value.toData()));
  },

  isEmpty() {
    return this.size === 0;
  },

  map(...args) {
    return this.entries().map(...args);
  },

  reduce(...args) {
    return this.entries().reduce(...args);
  },

  transform(fn) {
    const newMap = new Map();
    for (const [key, value] of this) {
      newMap.set(key, fn(value, key, this));
    }
    return newMap;
  },

  transformKeys(fn) {
    const newMap = new Map();
    for (const [key, value] of this) {
      newMap.set(fn(key, this), value);
    }
    return newMap;
  },

  merge(other) {
    const newMap = new Map();
    for (const [key, value] of this) { newMap.set(key, value) }
    for (const [key, value] of other) { newMap.set(key, value) }
    return newMap;
  },

  pick(...keys) {
    const newMap = new Map();
    for (const key of keys) {
      if (this.has(key)) {
        newMap.set(key, this.get(key));
      }
    }
    return newMap;
  },

  except(...keys) {
    const newMap = new Map();
    for (const [key, value] of this) {
      if (!keys.includes(key)) {
        newMap.set(key, value);
      }
    }
    return newMap;
  },

  inspect() {
    const pairs = this.reduce(
      (str, [key, value]) =>
        str === null
          ? `${key.inspect()} => ${value.inspect()}`
          : `${str}, ${key.inspect()} => ${value.inspect()}`,
      null
    );
    return `#<${this.constructor.name} ${pairs}>`;
  },

  toArray() {
    return this.entries().toArray();
  },

  toMap() {
    return this;
  },
});

Set.prototype.extend(Equatable, Hashable, Inspectable, Associative, {
  toData() {
    if (this.isEmpty()) {
      return EMPTY_SET;
    }

    return Object.freeze(this.transform((value) => value.toData()));
  },

  isEmpty() {
    return this.size === 0;
  },

  map(fn) {
    return this.values().map(fn);
  },

  reduce(fn) {
    return this.values().reduce(fn);
  },

  transform(fn) {
    const newSet = new Set();
    for (const value of this) {
      newSet.set(fn(value, this));
    }
    return newSet;
  },

  toArray() {
    return this.values().toArray();
  },

  toSet() {
    return this;
  },

  toMap() {
    return new Map(this.entries());
  },
});

globalThis.Date.prototype.extend(Equatable, Hashable, Inspectable, {
  hashCode() {
    return this.valueOf();
  },

  toData() {
    return this;
  },
});

export class Date extends BaseObject {
  static today() {
    return this.from(new globalThis.Date());
  }

  static yesterday() {
    return this.today().pred();
  }

  static from(date) {
    return new this(date.getFullYear(), date.getMonth() + 1, date.getDate());
  }

  #year;
  #month;
  #date;
  constructor(year, month, date) {
    super();
    this.#year = year;
    this.#month = month;
    this.#date = date;
  }

  get year() { return this.#year }
  get month() { return this.#month }
  get date() { return this.#date }

  isEqual(other) {
    return this.year === other.year && this.month === other.month && this.date === other.date;
  }

  succ() {
    return this.plus(1);
  }

  plus(amount) {
    return new this.constructor(this.year, this.month, this.date + amount);
  }

  pred() {
    return this.minus(1);
  }

  minus(amount) {
    return new this.constructor(this.year, this.month, this.date - amount);
  }

  toString() {
    return `#<${this.constructor.name} ${this.year}-${this.month.toString().padStart(2, '0')}-${this.date.toString().padStart(2, '0')}>`;
  }
}

RegExp.prototype.extend(Equatable, Hashable, Inspectable);
Function.prototype.extend(Equatable, Inspectable);

function booleanNumberCompare(boolean, number) {
  return boolean ? number === 1 : number === 0;
}

Number.prototype.extend(Equatable, Hashable, Inspectable, {
  hashCode() {
    return this;
  },

  toData() {
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

  succ() {
    return this.plus(1);
  },

  pred() {
    return this.minus(2);
  },

  plus(other) {
    return this + other;
  },

  minus(other) {
    return this - other;
  },

  div(other) {
    return this / other;
  },

  mult(other) {
    return this * other;
  },
});

function booleanStringCompare(boolean, string) {
  const lower = string.toLowerCase()
  return boolean
    ? lower === 'yes' || lower === '1' || lower === 'true'
    : lower === 'no' || lower === '0' || lower === 'false';
}

Boolean.prototype.extend(Equatable, Hashable, Inspectable, {
  display() {
    return this ? "Yes" : "No";
  },

  toData() {
    return this;
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
  display() {
    return `"${this}"`;
  },

  inspect() {
    return `"${this}"`;
  },

  hashCode() {
    return stringHash(this);
  },

  toData() {
    return this;
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
  },

  codePoints() {
    const array = []
    for (let i = 0; i < this.length; i++) {
      array.push(this.codePointAt(i));
    }
    return array;
  },

  succ() {
    const points = this.codePoints();
    points[points.length - 1] += 1;
    return this.constructor.fromCodePointArray(points);
  },

  pred() {
    const points = this.codePoints();
    points[points.length - 1] -= 1;
    return this.constructor.fromCodePointArray(points);
  },
});

String.fromCodePointArray = function(array) {
  return array.map((point) => this.fromCodePoint(point)).join('');
};

export class Range extends BaseObject {
  #begin;
  #end;
  #excludeEnd;
  constructor(begin, end, excludeEnd = false) {
    super();
    this.#begin = begin;
    this.#end = end;
    this.#excludeEnd = excludeEnd;
  }

  get begin() { return this.#begin }
  get end() { return this.#end }
  get excludeEnd() { return this.#excludeEnd }

  forEach(fn) {
    let x = this.begin;
    while (!x.isEqual(this.end)) {
      fn(x);
      x = x.succ();
    }
    if (!this.#excludeEnd) {
      fn(x);
    }
  }

  map(fn) {
    const array = [];
    this.forEach((it) => { array.push(fn(it)) });
    return array;
  }

  toArray() {
    const array = [];
    this.forEach(array.push.bind(array));
    return array;
  }

  reverse() {
    const array = [];
    this.forEach(array.unshift.bind(array));
    return array;
  }

  toString() {
    return `${this.begin}${this.#excludeEnd ? '...' : '..'}${this.end}`;
  }
}

// A default Null object
function NullBase(value){
  if (value == null) {
    return Null;
  }

  return value;
}

NullBase.extend(Base, {
  display() { return '-' },
  toString() { return 'Null' },
  valueOf() { return undefined },
  isNull() { return true },
  toData() { return EMPTY_MAP },
});

export const Null = new Proxy(NullBase, {
  get(nil, property, receiver) {
    if (Object.hasOwn(nil, property)) {
      return Reflect.get(nil, property);
    }

    return Null;
  },
  has(_target, _key) {
    return true;
  },
});

// object coercion
export function objectOf(value) {
  if (value == null) return Null;

  return Object(value);
}

