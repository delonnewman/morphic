import { capitalize, stringHash, Symbols } from './utils.mjs';

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
  [Symbols.customInspect]() { return this.toString() },

  [DENO_CUSTOM_INSPECT_SYMBOL]() { return this[Symbols.customInspect]() },
  [NODE_CUSTOM_INSPECT_SYMBOL]() { return this[Symbols.customInspect]() },
};

export class BaseError extends Error {
  get tag() { return 'Error' }
}

export class NotImplementedError extends BaseError {
  constructor(object, methodName) {
    super(`${methodName ?? 'method'} must be implemented by subclasses`);
    this.name = 'NotImplementedError';
    this.object = object;
    this.methodNmae = methodName;
  }
}

export class ArgumentError extends BaseError {
  constructor(given, expected) {
    super(`wrong number of arguments given ${given} expected ${expected}`);
    this.name = 'ArgumentError';
    this.given = given;
    this.expected = expected;
  }
}

export class MethodMissingError extends BaseError {
  constructor(object, methodName, args) {
    super(`unknown method ${methodName} for ${object}`);
    this.name = 'MethodMissingError';
    this.object = object;
    this.methodName = methodName;
    this.arguments = args;
  }
}

export const Hashable = {
  hashCode() {
    throw new NotImplementedError(this, 'hashCode');
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

  isNotIdentical(other) { return !this.isIdentical(other) },
  isNotEqual(other) { return !this.isEqual(other) },
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

  static inspect() {
    return `#<Class ${this.name}>`;
  }

  static toString() {
    return this.name;
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
    throw new NotImplementedError(this, methodName);
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

  respondsTo(methodName) {
    return this.mirror.respondsTo(methodName);
  }

  [Symbols.customInspect]() {
    return this.inspect();
  }

  inspect() {
    return this.toString();
  }

  freeze() {
    return Object.freeze(this);
  }
}

export function getTag(value) {
  if (value == null) return 'Null';

  if (value.tag) {
    return value.tag;
  }

  const type = typeof value;
  if (type !== 'object') {
    return capitalize(type);
  }

  if (value.constructor) {
    return value.constructor.name;
  }

  return 'Object';
}

export class GenericFunction extends BaseObject {
  static init(name = undefined) {
    const gfn = this.new(name ?? this.name);
    return new Proxy(gfn.toFunction(), {
      apply(target, _, args) {
        return target.apply(null, args);
      },
      get(_, property) {
        return Reflect.get(gfn, property);
      }
    });
  }

  static initClosure(name = undefined) {
    return (self, ...args) => {
      return gfn.apply(self, args);
    }
  }

  static #ignoredMethods = new Set(['call', 'constructor', 'apply', 'toString', 'toFunction']);
  static getDispatchMethodNames() {
    return this
      .prototype
      .mirror
      .getOwnMethodNames()
      .filter((prop) => !GenericFunction.#ignoredMethods.has(prop));
  }

  #name;
  constructor(name) {
    super();
    this.#name = name;
  }

  get name() { return this.#name }

  call(self, ...args) {
    const tag = getTag(self);
    const fn = this[tag];

    if (typeof fn !== 'function') {
      return this.methodMissing(self, tag, ...args);
    }

    return fn.call(self, ...args);
  }

  apply(self, args) {
    return this.call(self, ...args);
  }

  methodMissing(self, tag, ...args) {
    throw new MethodMissingError(this, tag, args);
  }

  toString() {
    const methods = this.constructor.getDispatchMethodNames();
    return `#<GenericFunction ${this.name} ${methods.join(', ')}>`;
  }

  toFunction() {
    return (self, ...args) => this.apply(self, args);
  }
}

export class Display extends GenericFunction {
  Null() { return '-' }

  String() {
    const buffer = []
    for (let i = 0; i < this.length; i++) {
      buffer.push(`&#${this.charCodeAt(i)};`);
    }
    return buffer.join('');
  }

  Boolean() {
    return this ? "Yes" : "No";
  }

  Error() {
    return `${this.name}: ${this.message}: ${this.stack}`;
  }

  methodMissing(self) {
    return self[Symbols.customInspect]();
  }
}
export const display = Display.init();

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
  [Symbols.customInspect]() {
    return `{${Object.entries(this)
      .map(([name, value]) => `${name}: ${inspect(value)}`)
      .join(", ")}}`
  },
});

// TODO: use this technique for extension methods https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object#instance_methods
Array.prototype.extend(Equatable, Hashable, Inspectable, {
  [Symbols.customInspect]() {
    return `[${this.map(inspect).join(", ")}]`;
  },

  hashCode() {
      return this.reduce((hash, item) => hashCombine(hash, item.hashCode()));
  },

  isEqual(other) {
    if (!(other instanceof Array)) return false;

    return this.hashCode() === other.hashCode();
  },
});

Map.prototype.extend(Equatable, Hashable, Inspectable, {
  [Symbols.customInspect]() {
    const pairs = this.entries().reduce(
      (str, [key, value]) =>
        str === null
          ? `${inspect(key)} => ${inspect(value)}`
          : `${str}, ${inspect(key)} => ${inspect(value)}`,
      null
    );
    return `#<${this.constructor.name} ${pairs}>`;
  },
});

Set.prototype.extend(Equatable, Hashable, Inspectable);

globalThis.Date.prototype.extend(Equatable, Hashable, Inspectable, {
  hashCode() {
    return this.valueOf();
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

Number.prototype.extend(Equatable, Hashable, Inspectable, {
  hashCode() {
    return this;
  },

  isEqual(other) {
    return this === other;
  },
});

Boolean.prototype.extend(Equatable, Hashable, Inspectable, {
  hashCode() {
    return this ? 1 : 0;
  },

  isEqual(other) {
    return this === other;
  },
});

String.prototype.extend(Equatable, Hashable, Inspectable, {
  [Symbol.customInspect]() {
    return `"${this}"`;
  },

  hashCode() {
    return stringHash(this);
  },

  isEqual(other) {
    if (typeof other !== 'string') return false;

    return this === other;
  },
});

// A default Null object
function NullBase(value){
  if (value == null) {
    return Null;
  }

  return value;
}

NullBase.extend(Base, {
  get tag() { return 'Null' },
  display() { return '-' },
  toString() { return this.tag },
  valueOf() { return undefined },
  isNull() { return true },
  toMap() { return EMPTY_MAP },
  toArray() { return EMPTY_ARRAY },
  toSet() { return EMPTY_SET },
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

export function inspect(value) {
  return objectOf(value)[Symbols.customInspect]();
}
