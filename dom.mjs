import { EMPTY_ARRAY } from './base.mjs';
import { AtomicMorph, NullMorph, Morph } from './core.mjs';

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
    this.children.push(morph);
    if (this.isInitialized()) { this.parent.redraw(this) }
    return morph;
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
    this.#enableAllObservers();

    this.parent.element.append(element);
  }

  drawSelf() {
    console.log('drawing self', this.toString(), this.element);
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

export class ExistingHTMLElementMorph extends HTMLElementMorph {
  #element;
  #currentHTML;
  constructor(parent, element) {
    super(parent, element.tagName, {}, []);
    for (const child of element.children) {
      this.addChild(this.constructor, child);
    }
    this.#element = element;
  }

  get element() { return this.#element; }

  drawSelf() {  }

  updateContent(content) {
    this.element.innerHTML = content.display();
    this.notifyObservers();
  }

  initialize() {
    this.element.setAttribute('data-morph-id', this.elementId);

    const observer = new MutationObserver((mutation) => { this.notifyObservers() });
    observer.observe(this.element, {
      attributes: true,
      childList: true,
      subtree: true,
      characterData: true
    });
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