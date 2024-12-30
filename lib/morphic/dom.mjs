import { EMPTY_ARRAY, display, BaseObject, inspect } from './base.mjs';
import { AtomicMorph, NullMorph, Morph, is_morphic } from './core.mjs';
import { drop } from './utils.mjs';

export class TextNodeMorph extends AtomicMorph {
  #node;
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

export class HTMLCodeMorph extends AtomicMorph {
  get children() { return EMPTY_ARRAY }

  drawSelf() {
    this.parent.element.innerHTML = this.value;
  }
}

export class HTMLClassListMorph extends Morph {
  #classes;
  constructor(parent, classes) {
    super(parent);
    if (typeof classes === "string") {
      this.#classes = classes.split(" ");
    } else {
      this.#classes = classes;
    }
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
    return `${this.name}=${inspect(this.value)}`
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
    attributes = { ...attributes };
    this.#attributes =
      Object.entries(attributes)
            .map(([name, value]) => new HTMLAttributeMorph(this, name, value))
            .reduce((mapping, morph) => ({ ...mapping, [morph.name]: morph }), {});

    this.#children = Object.values(this.#attributes);

    let classList = attributes.class ?? [];
    delete attributes.class;
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
    return Object.values(this.#attributes).map(inspect).join(' ');
  }

  toString() {
    return `#<${this.constructor.name}:${this.hexId} ${this.inspect()}>`
  }
}

export class HTMLElementMorph extends Morph {
  static tag(name, ...args) {
    const firstAttrs = !(args[0] instanceof Morph);
    const attributes = firstAttrs ? args[0] : {};
    const children = (firstAttrs ? drop(args, 1) : args)
          .map((child) => is_morphic(child) ? child.morph() : TextNodeMorph.build(`${child}`));

    return this.build(name, attributes).add(...children);
  }

  #tagName;
  #attributes;
  #children;
  #eventObservers;
  #element;
  constructor(parent, tagName, attributes = {}, children = []) {
    super(parent);
    this.#tagName = tagName;
    this.#attributes = new HTMLAttributeListMorph(this, { ...attributes, 'data-morph-id': this.elementId });
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
    return `#<${this.constructor.name}:0x${this.hexId} ${this.tagName} ${inspect(this.attributes)} ${inspect(this.children)}>`;
  }

  observeEvent(event, ...observers) {
    this.#eventObservers[event] ??= [];
    this.#eventObservers[event].push(...observers);
    if (this.isInitialized()) {
      this.#enableEventObservers(event, observers);
    }
    return this;
  }

  addChild(morphClass, ...args) {
    const morph = new morphClass(this, ...args);
    this.children.push(morph);
    if (this.isInitialized()) { this.parent.redraw(this) }
    return morph;
  }

  add(unboundMorph) {
    const morph = unboundMorph.bind(this)
    this.children.push(morph);
    return morph;
  }

  tag(...args) {
    return this.add(HTMLElementMorph.tag(...args));
  }

  replaceChildren(...children) {
    this.#children = children;
    if (this.isInitialized()) { this.parent.redraw(this) }
    return this;
  }

  createElement(tagName, attributes = {}, children = []) {
    return this.addChild(HTMLElementMorph, tagName, attributes, children);
  }

  findElement(query) {
    return this.element.querySelector(query);
  }

  addExisting(query) {
    const element = this.findElement(query);
    if (element == null) return;

    return this.addChild(ExistingHTMLElementMorph, element);
  }

  withText(text) {
    this.addChild(TextNodeMorph, text);
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
    this.#enableAllEventObservers();
    this.#enableContentObservers();

    this.parent.element.append(element);
  }

  drawSelf() {
    console.debug('drawing self', this.toString());
    this.#attributes.draw();
  }

  observeWith(...observers) {
    const notObserved = !this.isObserved();
    super.observeWith(...observers);
    if (notObserved && this.isInitialized()) {
      this.#enableContentObservers();
    }
    return this;
  }

  updateContent(content) {
    if (content instanceof HTMLElementMorph) {
      this.replaceChildren(content);
    } else {
      this.element.innerHTML = display(content);
    }
    this.notifyObservers();
  }

  #enableContentObservers() {
    if (!this.isObserved()) return;

    const observer = new MutationObserver(() => { this.notifyObservers() });
    observer.observe(this.element, {
      attributes: true,
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  #enableAllEventObservers() {
    this.events.forEach((eventName) => {
      const observers = this.#eventObservers[eventName];
      this.#enableEventObservers(eventName, observers);
    });
  }

  #enableEventObservers(eventName, observers) {
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

export class ExistingHTMLElementMorph extends HTMLElementMorph {
  #element;
  constructor(parent, element) {
    super(parent, element.tagName, {}, []);
    for (const child of element.children) {
      this.addChild(this.constructor, child);
    }
    this.#element = element;
  }

  get element() { return this.#element; }

  drawSelf() {  }

  initialize() {
    this.element.setAttribute('data-morph-id', this.elementId);
    super.initialize();
  }
}

export class HTMLDocumentMorph extends HTMLElementMorph {
  constructor() {
    super(NullMorph, 'document');
  }

  draw() { }
  get element() { return document }
}

export class HTMLDocumentBodyMorph extends HTMLElementMorph {
  constructor() {
    super(new HTMLDocumentMorph(), 'body', {}, []);
  }

  isInitialized() { return true }
  get element() { return document.body }
}

export class HTMLMorphBuilder extends BaseObject {
  static tag(...args) {
    const morph = HTMLElementMorph.tag(...args);
    return this.new(morph);
  }

  #parent;
  constructor(parent) {
    super();
    this.#parent = parent;
  }

  tag(...args) {
    const morph = HTMLElementMorph.tag(...args);
    this.#parent.add(morph);
    return this;
  }

  text(content) {
    const morph = TextNodeMorph.build(content);
    this.#parent.add(morph);
    return this;
  }

  isBound() { return false }
  bind(parent) {
    return this.#parent.bind(parent);
  }
}

export function tag(...args) {
  const morph = HTMLElementMorph.tag(...args);
  return HTMLMorphBuilder.new(morph);
}
