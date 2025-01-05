import { BaseObject, BaseError, EMPTY_ARRAY, ValueObject, NotImplementedError } from './base.mjs';
import { arrayHash, stringHash, hashCombine, to_data } from './utils.mjs';
import { JavaScript } from './javascript.mjs';

export class UncaughtThrowError extends BaseError {
  constructor(object) {
    super(`uncaught throw of ${object}`);
    this.name = 'UncaughtThrowError';
    this.object = object;
  }
}

export class Script extends BaseObject {
  static build(dispatches = undefined) {
    return new this(Binding.global(), ExecutionContext.global(dispatches));
  }

  #binding; // lexically scoped bindings
  #context;
  constructor(binding, context) {
    super();
    this.#binding = binding;
    this.#context = context;
  }

  get binding() { return this.#binding }
  get self() { return this.#binding.self }

  child({ lexical, self }) {
    lexical ??= false
    self ??= this.self;

    const binding = lexical
          ? this.#binding.child().set('self', self)
          : this.#binding

    return new Script(binding, new ExecutionContext(this.#context));
  }

  get(name) {
    return this.binding.get(name);
  }

  set(name, value) {
    this.binding.set(name, value);
    return value;
  }

  add_dispatch(dispatch) {
    this.#context.add_dispatch(dispatch);
    return this;
  }

  forEach(fn) {
    this.#context.forEach(fn);
  }

  send(dispatch) {
    this.add_dispatch(dispatch);
    return dispatch;
  }

  continution() {
    this.#context.pause()
    return () => this.#context.resume();
  }

  run() {
    return this.#context.execute();
  }

  then(on_success, on_failure = undefined) {
    try {
      on_success(this.run());
    } catch (e) {
      if (on_failure) on_failure(e);
    }
  }

  to_data() {
    return this.#context.to_data();
  }
}

export class ExecutionContext extends BaseObject {
  static global(dispatches = undefined) {
    return new this({ parent: undefined, dispatches });
  }

  #parent;
  #paused;
  #running;
  #pause_request;
  #dispatches;
  constructor({ parent, dispatches, paused_at }) {
    super();
    this.#parent = parent;
    this.#paused = paused_at ?? false;
    this.#running = false;
    this.#pause_request = false;
    this.#dispatches = dispatches ?? [];
  }

  is_global() { return this.#parent === undefined }

  add_dispatch(dispatch) {
    this.#dispatches.push(dispatch);
    return this;
  }

  forEach(fn) {
    for (const dispatch of this.#dispatches) {
      fn(dispatch, this);
    }
  }

  to_data() {
    const map = new Map();

    if (this.#parent) map.set('parent', this.#parent.to_data());
    if (this.paused()) map.set('paused_at', this.paused_at);
    map.set('dispatches', this.#dispatches.map((disptach) => disptach.to_data()));

    return map;
  }

  get parent() { return this.#parent }
  get paused() { return this.#paused !== false }
  get paused_at() { return this.paused ? this.#paused : undefined }
  get running() { return this.#running === true }

  resume() {
    this.resume_at(this.paused_at);
  }

  execute() {
    return this.resume_at(0);
  }

  pause() {
    this.#pause_request = true;
  }

  validateIndex(index) {
    if (index > (this.#dispatches.length - 1)) {
      throw new Error(`invalid statement index: ${index}`);
    }
  }

  resume_at(index) {
    this.validateIndex(index);
    const dispatches = this.#dispatches;

    this.#running = true;
    this.#paused = false;

    let result;
    for (let i = index; i < dispatches.length; i++) {
      if (this.#pause_request) {
        this.pause_at(i);
        break;
      }
      result = dispatches[i].execute();
    }
    this.#running = false;

    return result;
  }

  pause_at(index) {
    this.validateIndex(index);
    this.#paused = index;
    this.#running = false;
  }
}

export class Binding extends BaseObject {
  static global() {
    return new this(undefined).set('self', globalThis);
  }

  #parent;
  #variables;
  #meta;
  constructor(parent) {
    super()
    this.#parent = parent;
    this.#variables = new Map();
    this.#meta = new Map();
  }

  is_global() { return this.#parent === undefined }

  child() {
    return new Binding(this);
  }

  // the current 'self'
  get self() { return this.get('self') }

  get(name) {
    if (this.#variables.has(name)) {
      return this.#variables.get(name);
    }

    if (this.#parent) {
      return this.#parent.get(name);
    }

    throw new Error(`Unknown variable: ${name}`);
  }

  set(name, value, meta = undefined) {
    this.#variables.set(name, value);
    this.#meta.set(name, new Map(to_data(meta)));
    return this;
  }

  set_global(name, value, meta = undefined) {
    if (this.is_global()) {
      this.set(name, value, meta);
    } else {
      this.#parent.set_global(name, value, meta);
    }
    return this;
  }
}

export const Meta = {
  meta() { throw new NotImplementedError(this, 'meta') },
  with_meta(meta) { throw new NotImplementedError(this, 'with_meta') }
};

export class Dispatch extends BaseObject {
  static { this.include(Meta) }

  static #extensions = new Map();
  static register_extension(message, fn) {
    Dispatch.#extensions.set(message.hashCode(), fn);
  }

  static extension_of(message) {
    return Dispatch.#extensions.get(message.hashCode());
  }

  #subject;
  #message;
  #meta;
  constructor(subject, message, meta = undefined) {
    super();
    this.#subject = subject;
    this.#message = message;
    this.#meta = new Map(to_data(meta));
  }

  get subject() { return this.#subject }
  get message() { return this.#message }

  meta() { return this.#meta }
  with_meta(meta) { return this.constructor.new(this.subject, this.message, meta) }

  execute() {
    const subject = this.subject instanceof Dispatch ? this.subject.execute() : this.subject;
    const message = this.message;

    const ext = this.constructor.extension_of(message);
    if (ext !== undefined) {
      return ext(subject, message);
    }

    if (message.hashCode() in subject) {
      return subject[message.hashCode()].apply(subject, message.to_arguments());
    }

    // look for variably parameterized messages
    if (message instanceof ParameterizedMessage && message.name_hash() in subject) {
      return subject[message.name_hash()].apply(subject, message.to_arguments());
    }

    if (!(message.name in subject)) {
      return new MethodMissingError(subject, message.name, message.to_arguments());
    }

    if (message.is_unary()) {
      return subject[message.name];
    }

    return subject[message.name].apply(subject, message.to_arguments());
  }

  then_send(message) {
    return this.constructor.new(this, message);
  }

  then(on_success, on_failure = undefined) {
    try {
      on_success(this.execute());
    } catch (e) {
      if (on_failure) on_failure(e);
    }
  }
}


export class Message extends ValueObject {
  static postfix(name) {
    return this.new(name);
  }

  static unary(name) {
    return this.postfix(name);
  }

  static prefix(name) {
    return PrefixMessage.new(name);
  }

  static param(name, ...params) {
    return ParameterizedMessage.new(name, undefined, ...params);
  }

  static var_param(name, ...params) {
    return VariablyParameterizedMessage.new(name, undefined, ...params);
  }

  static keyword(keywords) {
    return KeywordMessage.new(keywords);
  }

  static binary(name, other) {
    return BinaryMessage.new(name, other);
  }

  static { this.include(Meta) }

  static new(...args) {
    return super.new(...args).freeze();
  }

  #name;
  #hashCode;
  #meta;
  constructor(name, meta = undefined) {
    super();
    this.#name = name;
    this.#hashCode = stringHash(name);
    this.#meta = meta ?? new Map();
  }

  meta() { return this.#meta }
  with_meta(meta) { return this.constructor.new(this.name, meta) }

  get name() { return this.#name }

  hashCode() { return this.#hashCode }
  name_hash() { return this.#hashCode }
  is_unary() { return true }
  to_arguments() { return EMPTY_ARRAY }

  is_equivalent(other) {
    if (!(other instanceof Message)) {
      return false;
    }

    return this.hashCode() === other.hashCode()
  }
}

export class PrefixMessage extends Message {}

export class BinaryMessage extends Message {
  #other;
  #hashCode;
  constructor(name, other, meta) {
    super(name, meta);
    this.#other = other;
    this.#hashCode = hashCombine(stringHash(name), hashCode(other));
  }

  get other() { return this.#other }

  hashCode() { return this.#hashCode}
  is_unary() { return false }
  to_arguments() { return [this.other] }

  with_meta(meta) { return this.constructor.new(this.name, this.other, meta) }
}

export class ParameterizedMessage extends Message {
  #parameters;
  #hashCode;
  #name_hash;
  constructor(name, meta = undefined, ...parameters) {
    super(name, meta);
    this.#name_hash = stringHash(name);
    this.#hashCode = hashCombine(this.#name_hash, parameters.length);
    this.#parameters = parameters;
  }

  hashCode() { return this.#hashCode }
  name_hash() { return this.#name_hash }
  is_unary() { return false }
  to_arguments() { return this.#parameters }

  max_arity() { return this.#parameters.length }
  min_arity() { return this.#parameters.length }

  with_meta(meta) { return this.constructor.new(this.name, meta, ...this.#parameters) }
}

export class VariablyParameterizedMessage extends ParameterizedMessage {
  hashCode() { return this.name_hash() }
}

export class KeywordMessage extends Message {
  #keywords;
  #hashCode;
  constructor(keywords, meta = undefined) {
    const name = Object.keys(keywords)[0];
    super(name, meta);
    this.#hashCode = arrayHash(Object.keys(keywords));
    this.#keywords = keywords;
  }

  hashCode() { return this.#hashCode }
  is_unary() { return false }
  to_arguments() { return [this.#keywords] }

  with_meta(meta) { return this.constructor.new(this.#keywords, meta) }
}

Dispatch.register_extension(Message.var_param('invoke'), (subject, message) => {
  return subject.apply(subject, message.to_arguments());
});

Dispatch.register_extension(Message.var_param('+'), (subject, message) => {
  return JavaScript.sum(subject, ...message.to_arguments());
});
