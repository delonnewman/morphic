import { BaseObject, BaseError, EMPTY_ARRAY, ValueObject } from './base.mjs';
import { arrayHash, stringHash, hashCombine, hashCode } from './utils.mjs';

export class UncaughtThrowError extends BaseError {
  constructor(object) {
    super(`uncaught throw of ${object}`);
    this.name = 'UncaughtThrowError';
    this.object = object;
  }
}

export class Script extends BaseObject {
  static build(dispatches = undefined) {
    return new this(Binding.top(), dispatches);
  }

  #binding; // lexically scoped bindings
  #dispatches;
  constructor(binding, dispatches = undefined) {
    super();
    this.#binding = binding;
    this.#dispatches = dispatches ?? [];
  }

  get self() { return this.#binding.self }
  get context() { return this.#binding.context }
  get binding() { return this.#binding }

  child({ lexical, context, self }) {
    lexical ??= false
    context ??= this.context;
    self ??= this.self;

    const binding = lexical
          ? this.#binding.child().set('context', context).set('self', self)
          : this.#binding

    return new Script(binding);
  }

  lookup_variable(name) {
    return this.binding.get(name);
  }

  assign_variable(name, value) {
    this.binding.set(name, value);
    return value;
  }

  send(dispatch) {
    this.#dispatches.push(dispatch);
    return dispatch;
  }

  run() {
    const dispatches = this.#dispatches;
    let result;
    for (let i = 0; i < dispatches.length; i++) {
      result = dispatches[i].execute();
    }
    return result;
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
  #parent;
  #catchers;
  #paused;
  #running;
  #pause_request;
  constructor(parent) {
    super();
    this.#parent = parent;
    this.#catchers = new Map();
    this.#paused = false;
    this.#running = false;
    this.#pause_request = false;
  }

  get parent() { return this.#parent }

  throw(object) {
    this.pause();
    this.find_catch(object);
  }

  catch(object, block) {
    this.#catchers.set(object, block);
  }

  find_catch(object) {
    if (this.#catchers.has(object)) {
      return this.#catchers.get(object);
    }

    if (this.parent) {
      return this.parent.find_catch(object);
    }

    throw new UncaughtThrowError(object);
  }

  get paused() { return this.#paused !== false }
  get paused_at() { return this.paused ? this.#paused : undefined }

  get running() { return this.#running === true }

  resume() {
    this.resume_at(this.paused_at);
  }

  execute() {
    this.resume_at(0)
  }

  pause() {
    this.#pause_request = true;
  }

  resume_at(index) {
    // if (index > (this.#dispatches.length - 1)) {
    //   throw new Error(`invalid statement index: ${index}`);
    // }

    // this.#running = true;
    // this.#paused = false;

    // const dispatches = this.#dispatches;
    // for (let i = index; i < dispatches.length; i++) {
    //   if (this.#pause_request) {
    //     this.pause_at(i)
    //     break;
    //   }
    //   dispatches[i].send();
    // }
  }

  #pause_at(index) {
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

  // the execution context for control flow
  get context() { return this.get('context') }

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

    if (message.hashCode() in subject) {
      return subject[message.hashCode()].apply(subject, message.to_arguments());
    }

    const ext = this.constructor.extension_of(message);
    if (ext !== undefined) {
      return ext(subject, message);
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
  #name;
  #hashCode;
  constructor(name) {
    super();
    this.#name = name;
    this.#hashCode = stringHash(name);
  }

  get name() { return this.#name }

  hashCode() { return this.#hashCode }
  is_unary() { return true }
  to_arguments() { return EMPTY_ARRAY; }
}

export class ParameterizedMessage extends Message {
  #parameters;
  #hashCode;
  constructor(name, parameters) {
    super(name);
    this.#hashCode = hashCombine(stringHash(name), parameters.length);
    this.#parameters = parameters;
  }

  hashCode() { return this.#hashCode }
  is_unary() { return false }
  to_arguments() { return this.#parameters }
}

export class VariablyParameterizedMessage extends Message {
  #parameters;
  #hashCode;
  constructor(name, parameters = []) {
    super(name);
    this.#hashCode = stringHash(name);
    this.#parameters = parameters;
  }

  hashCode() { return this.#hashCode }
  is_unary() { return false }
  to_arguments() { return this.#parameters }
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
