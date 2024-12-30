import { BaseObject, BaseError, EMPTY_ARRAY, ValueObject } from './base.mjs';
import { arrayHash, stringHash, hashCombine, hashCode } from './utils.mjs';
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
    return new this(Binding.top(), ExecutionContext.top(), dispatches);
  }

  #binding; // lexically scoped bindings
  #context;
  constructor(binding, context, dispatches = undefined) {
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

  lookup_variable(name) {
    return this.binding.get(name);
  }

  assign_variable(name, value) {
    this.binding.set(name, value);
    return value;
  }

  send(dispatch) {
    return this.#context.addDispatch(dispatch);
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
}

export class ExecutionContext extends BaseObject {
  static top() {
    return new this(undefined);
  }

  #parent;
  #paused;
  #running;
  #pause_request;
  #dispatches;
  constructor(parent, dispatches = undefined) {
    super();
    this.#parent = parent;
    this.#paused = false;
    this.#running = false;
    this.#pause_request = false;
    this.#dispatches = dispatches ?? [];
  }

  addDispatch(dispatch) {
    this.#dispatches.push(dispatch);
    return dispatch;
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
  static top() {
    return new this(undefined).set('self', globalThis);
  }

  #parent;
  #variables;
  constructor(parent) {
    super()
    this.#parent = parent;
    this.#variables = new Map()
  }

  child() {
    return new Binding(this);
  }

  // the current 'self'
  get self() { return this.get('self') }

  get(name) {
    if (this.#variables.has(name)) {
      return this.#variables.get(name);
    }

    if (this.parent) {
      return this.parent.get(name);
    }

    throw new Error(`Unknown variable: ${name}`);
  }

  set(name, value) {
    this.#variables.set(name, value);
    return this;
  }
}

export class Dispatch extends BaseObject {
  static #extensions = new Map();
  static register_extension(message, fn) {
    Dispatch.#extensions.set(message.hashCode(), fn);
  }

  static extension_of(message) {
    return Dispatch.#extensions.get(message.hashCode());
  }

  #subject;
  #message;
  constructor(subject, message) {
    super();
    this.#subject = subject;
    this.#message = message;
  }

  get subject() { return this.#subject }
  get message() { return this.#message }

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
  static new(...args) {
    return super.new(...args).freeze();
  }

  #name;
  #hashCode;
  constructor(name) {
    super();
    this.#name = name;
    this.#hashCode = stringHash(name);
  }

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

export class ParameterizedMessage extends Message {
  #parameters;
  #hashCode;
  #name_hash;
  constructor(name, ...parameters) {
    super(name);
    this.#name_hash = stringHash(name);
    this.#hashCode = hashCombine(this.#name_hash, parameters.length);
    this.#parameters = parameters;
  }

  hashCode() { return this.#hashCode }
  name_hash() { return this.#name_hash }
  is_unary() { return false }
  to_arguments() { return this.#parameters }
}

export class VariablyParameterizedMessage extends ParameterizedMessage {
  hashCode() { return this.name_hash() }
}

export class KeywordMessage extends Message {
  #keywords;
  #hashCode;
  constructor(keywords) {
    const name = Object.keys(keywords)[0];
    super(name);
    this.#hashCode = arrayHash(Object.keys(keywords));
    this.#keywords = keywords;
  }

  is_unary() { return false }
  to_arguments() { return [this.#keywords] }
}

Dispatch.register_extension(VariablyParameterizedMessage.new('invoke'), (subject, message) => {
  return subject.apply(subject, message.to_arguments());
});

Dispatch.register_extension(VariablyParameterizedMessage.new('+'), (subject, message) => {
  return JavaScript.sum(subject, ...message.to_arguments());
});
