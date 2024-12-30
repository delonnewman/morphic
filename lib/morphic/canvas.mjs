import { HTMLElementMorph } from './dom.mjs';
import { Morph } from './core.mjs';
import { EMPTY_ARRAY, inspect, ValueObject } from './base.mjs';

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

  reset() {
    console.debug('clearing');
    // clear canvas
    this.context.clearRect(0, 0, this.element.width, this.element.height);
  }

  redraw(child) {
    this.reset();
    this.draw();
  }

  drawSelf() {
    this.reset();
  }
}

export class CanvasChildMorph extends Morph {
  get context() { return this.parent.context }
  get children() { return EMPTY_ARRAY } // for now default to no children
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
    return `#<${this.constructor.name}:${this.hashCode()} ${inspect(this)}>`;
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

  morph(parent = NilMorph, style = this.constructor.defaultStyle()) {
    return new CanvasShapeMorph(parent, this, style);
  }

  right(amount) {
    return this.translateTo(this.position.right(amount));
  }

  left(amount) {
    return this.translateTo(this.position.left(amount));
  }

  up(amount) {
    return this.translateTo(this.position.up(amount));
  }

  down(amount) {
    return this.translateTo(this.position.down(amount));
  }

  translateTo(position) {
    return new TranslatedShape(this, position);
  }

  rotate(degrees) {
    return new RotatedShape(this, degrees);
  }

  draw(context) {
    this.subclassShouldImplement('draw');
  }

  toString() {
    return `#<${this.constructor.name}:${this.hashCode()} @ ${inspect(this.position)}>`;
  }
}

export class TranslatedShape extends Shape {
  #shape;
  #position;
  constructor(shape, position) {
    super(position);
    this.#shape = shape;
  }

  hashCode() {
    return hashCombine(this.#shape.hashCode(), this.position.hashCode());
  }

  translateTo(position) {
    return new TranslatedShape(this.#shape, position);
  }

  draw(context) {
    context.translate(this.position.x, this.position.y);
    this.#shape.draw(context);
  }

  toString() {
    return `#<${this.constructor.name} ${this.#shape} to ${inspect(this.position)}>`;
  }
}

export class RotatedShape extends Shape {
  #shape;
  #degrees;
  constructor(shape, degrees) {
    super(shape.position);
    this.#shape = shape;
    this.#degrees = degrees;
  }

  hashCode() {
    return hashCombine(this.#shape.hashCode(), this.#degrees.hashCode());
  }

  draw(context) {
    context.rotate((this.#degrees * Math.PI) / 180);
    this.#shape.draw(context);
    // set transformation matrix to the identity matrix
    context.setTransform(1, 0, 0, 1, 0, 0);
  }

  toString() {
    return `#<${this.constructor.name} ${inspect(this.#degrees)}° ${this.#shape}>`;
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

  hashCode() {
    return hashCombine(
      hashCombine(this.position.hashCode(), this.width.hashCode()),
      this.height.hashCode()
    );
  }

  draw(context) {
    context.rect(this.position.x, this.position.y, this.width, this.height);
    return this;
  }

  toString() {
    return `#<${this.constructor.name} width=${this.width} height=${this.height} @ ${inspect(this.position)}>`;
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

  hashCode() {
    return hashCombine(this.position.hashCode(), this.radius.hashCode());
  }

  draw(context) {
    context.arc(this.position.x, this.position.y, this.radius, 0, 2 * Math.PI);
  }

  toString() {
    return `#<${this.constructor.name} radius=${this.radius} @ ${inspect(this.position)}>`;
  }
}

export class Style extends ValueObject {
  draw(context) {
    this.subclassShouldImplement('draw');
  }
}

export class FillColor extends Style {
  static getColor(object) {
    return object.#color;
  }

  static setColor(object, value) {
    object.#color = value;
    return object;
  }

  static setProperty(object, property, value) {
    eval(`object.#${property} = value`);
    return object;
  }

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
    return `#<${this.constructor.name} ${this.color}>`;
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
    return `#<${this.constructor.name} ${this.color}>`;
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
    return `#<${this.constructor.name} ${this.width}>`;
  }
}

export class StyleCombination extends Style {
  #styles;
  constructor(...styles) {
    super()
    this.#styles = styles;
  }

  hashCode() {
    return this.#styles.hashCode();
  }

  draw(context) {
    this.#styles.forEach((style) => { style.draw(context) })
  }

  toString() {
    return `#<${this.constructor.name} ${inspect(this.#styles)}>`;
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

  rotate(degrees) {
    this.shape = this.shape.rotate(degrees);
  }

  drawSelf() {
    console.debug(this.toString(), 'drawSelf');
    this.context.beginPath();
    this.#shape.draw(this.context);
    this.#style.draw(this.context);
  }

  toString() {
    return `#<${this.constructor.name}:0x${this.hexId} style=${this.style} shape=${this.shape}>`;
  }
}
