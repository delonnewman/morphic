const basicPrinter = (value) => value.toString();

const PRINTERS = {
  number: basicPrinter,
  boolean: (value) => (value ? "Yes" : "No"),
  string: (value) => `"${value}"`,
  function: basicPrinter,
  array: (value) => `[${value.map(print).join(", ")}]`,
  object: (value) =>
    `{${Object.entries(value)
      .map(([name, value]) => `${name}: ${print(value)}`)
      .join(", ")}}`,
  date: basicPrinter,
};

export function print(object) {
  if (object == null) return "-";
  const type = typeof object;
  if (type === "object" && Array.isArray(object)) {
    return PRINTERS.array(object);
  } else if (object instanceof Date) {
    return PRINTERS.date(object);
  }
  return PRINTERS[type](object);
}

export class World {
  constructor(container) {
    this.container = container;
    this.children = [];
  }

  add(morph) {
    this.children.push(morph);
    this.render();
  }

  render() {}
}

export class MorphFactory {
  static registry = {};
  static register(tag, constructor, { predicate, shouldCache }) {
    this.registry[tag] = {
      shouldCache,
      predicate,
      constructor,
    };
  }

  buildFor(value) {
    const registry = Object.entries(this.constructor.registry).reverse();
    for (const [tag, { predicate, constructor, shouldCache }] of registry) {
      if (predicate(value)) {
        return new constructor(value);
      }
    }

    throw new Error(`Don't know how to make a morph for ${print(value)}`);
  }
}

let CURRENT_MORPHIC_ID = 0;

export class Morph {
  static nextID() {
    return CURRENT_MORPHIC_ID++;
  }

  static #factory = undefined;
  static factory() {
    return (this.#factory ??= new MorphFactory());
  }

  static of(value) {
    if (value instanceof Morph) {
      return value;
    }

    return this.factory().buildFor(value);
  }

  static valueOf(morph) {
    if (morph instanceof Morph) {
      return morph.value;
    }

    return morph;
  }

  #value;
  #originalValue;
  #renderedValue;
  #children;
  #morphic_id;

  constructor(value) {
    this.#morphic_id = this.constructor.nextID();
    this.#value = value;
    this.#originalValue = value;
    this.#renderedValue = undefined;
    this.#children = [];
  }

  add(...morphs) {
    this.#children.push(...morphs);
    return this;
  }

  get morphic_id() {
    return this.#morphic_id;
  }

  valueOf() {
    return this.#value;
  }

  get value() {
    return this.#value;
  }

  set value(newValue) {
    this.#value = newValue;
    this.renderValue();
  }

  isRendered() {
    return this.#value === this.#renderedValue;
  }

  renderSelf() {
    if (!this.isSetup()) this.setup();
    //if (!this.isRendered()) {
    console.debug("rendering value");
    this.renderValue();
    //this.#renderedValue = this.#value;
    console.log("renderedValue", this.#renderedValue, this.isRendered());
    //}
  }

  resetValue() {
    this.value = this.#originalValue;
  }

  renderValue() {
    console.debug("failed to runder value");
    throw new Error(`should be implemented by subclass`);
  }

  isSetup() {
    return false;
  }
  setup() {}

  get children() {
    return this.#children;
  }

  isIdentical(other) {
    return this.morphic_id === other.morphic_id;
  }

  isEqual(other) {
    return this.isIdentical(other);
  }

  print() {
    return print(this.value);
  }

  toString() {
    return `#<${this.constructor.name}:0x${this.hex_id} ${this.print()}>`;
  }

  get element_id() {
    return `morphic-${this.hex_id}`;
  }

  get hex_id() {
    return `${this.morphic_id.toString(16).padStart(4, "0")}`;
  }
}

export class DOMMorph extends Morph {
  #valueElement;
  #containerElement;

  constructor(value) {
    super(value);
    this.#valueElement = undefined;
    this.#containerElement = undefined;
  }

  get element() {
    return this.#valueElement;
  }

  set element(value) {
    this.#valueElement = value;
  }

  get containerElement() {
    return this.#containerElement;
  }

  set containerElement(value) {
    this.#containerElement = value;
    if (
      this.#containerElement instanceof HTMLElement &&
      !this.#containerElement.hasAttribute("id")
    ) {
      this.#containerElement.setAttribute("id", this.element_id);
    }
  }

  render(parentElement) {
    console.debug("render", this.toString());
    if (!this.isSetup()) this.setup();
    console.debug("rendering value");
    this.renderValue();

    this.children.forEach((child) => {
      if (!child.isRendered()) {
        child.render(this.containerElement);
      }
    });

    this.renderContainer(parentElement);
  }

  renderContainer(parentElement) {
    const element = this.querySelector(`#${this.element_id}`);
    if (element) {
      console.log("replacing", element, this.toString());
      parentElement.replaceChild(this.containerElement, element);
    } else {
      parentElement.append(this.containerElement);
    }
  }

  renderValue() {
    console.debug(`${this.toString()}.renderValue`, this.print(), this.element);
    this.element.innerHTML = this.print();
  }

  isSetup() {
    return (
      this.containerElement !== undefined && this.valueElement !== undefined
    );
  }

  setup() {
    console.log("setting up");
    const element = this.create();
    this.containerElement = element;
    this.element = element;
  }

  create() {
    return document.createTextNode(print(this.value));
  }

  // Helper methods for subclasses

  createElement(tagName, attributes) {
    attributes = { ...attributes };
    let classList = attributes.class ?? [];
    delete attributes.class;
    if (typeof classList === "string") classList = classList.split(" ");

    const element = document.createElement(tagName);
    element.classList.add(...classList);
    Object.entries(attributes).forEach(([name, value]) => {
      element.setAttribute(name, value);
    });

    return element;
  }

  querySelector(selector) {
    if (
      this.containerElement === undefined ||
      this.containerElement.querySelector === undefined
    ) {
      return;
    }

    return this.containerElement.querySelector(selector);
  }
}

export class ActiveDOMMorph extends DOMMorph {
  #prototype;

  constructor(value, prototype) {
    super(value);
    this.#prototype = {
      ...prototype,
      reset: this.resetValue,
    };
  }

  get buttonAttributes() {
    return {
      type: "button",
      "data-toggle": "dropdown",
      "aria-expanded": "false",
      class: this.buttonClassList,
    };
  }

  get buttonClassList() {
    return ["btn", "btn-link", "dropdown-toggle", "btn-sm"];
  }

  get menuAttributes() {
    return {
      class: this.menuClassList,
    };
  }

  get menuClassList() {
    return ["dropdown-menu"];
  }

  get menuItemAttributes() {
    return {
      class: ["dropdown-item"],
      href: "#",
    };
  }

  setup() {
    const container = document.createElement("div");
    container.classList.add("btn-group");

    this.element = this.createElement("button", this.buttonAttributes);
    container.append(this.element);

    const dropdown = this.createElement("div", this.menuAttributes);
    Object.getOwnPropertyNames(this.#prototype).forEach((property) => {
      this.renderAction(property, dropdown);
    });
    container.append(dropdown);

    this.containerElement = container;
  }

  renderAction(action, menu) {
    const link = this.createElement("a", this.menuItemAttributes);
    link.innerText = action;
    link.addEventListener("click", (e) => {
      this.#prototype[action].call(this);
      e.preventDefault();
    });
    menu.append(link);
  }
}

export class NullishMorph extends ActiveDOMMorph {
  static actions = {
    set() {
      this.value = prompt("Set value");
    },
  };

  constructor(value) {
    super(value, NullishMorph.actions);
  }

  toString() {
    return `#<${this.constructor.name}:0x${this.hex_id}>`;
  }
}

export class NullMorph extends NullishMorph {
  constructor() {
    super(null);
  }

  isEqual(other) {
    return other instanceof NullMorph;
  }
}
MorphFactory.register("null", NullMorph, {
  predicate: (value) => value === null,
});

export class UndefinedMorph extends NullishMorph {
  constructor() {
    super(undefined);
  }

  isEqual(other) {
    return other instanceof UndefinedMorph;
  }
}
MorphFactory.register("undefined", UndefinedMorph, {
  predicate: (value) => value === undefined,
});

export class BooleanMorph extends ActiveDOMMorph {
  static actions = {
    negate() {
      this.value = !this.value.valueOf();
    },
  };

  constructor(value) {
    super(value, BooleanMorph.actions);
  }

  toString() {
    return `#<${this.constructor.name}:0x${this.hex_id}>`;
  }
}

export class FalseMorph extends BooleanMorph {
  constructor() {
    super(false);
  }

  isEqual(other) {
    return other instanceof FalseMorph;
  }
}
MorphFactory.register("false", FalseMorph, {
  shouldCache: true,
  predicate: (value) => value === false,
});

export class TrueMorph extends BooleanMorph {
  constructor() {
    super(true);
  }

  isEqual(other) {
    return other instanceof TrueMorph;
  }
}
MorphFactory.register("true", TrueMorph, {
  shouldCache: true,
  predicate: (value) => value === true,
});

export class NumberMorph extends ActiveDOMMorph {
  static actions = {
    ["+"]() {
      const otherValue = parseInt(
        prompt("Enter the number you'd like to add:"),
        10
      );
      this.value = this.value + otherValue;
    },
    ["-"]() {
      const otherValue = parseInt(
        prompt("Enter the number you'd like to subtract:"),
        10
      );
      this.value = this.value - otherValue;
    },
    ["*"]() {
      const otherValue = parseInt(
        prompt("Enter the number you'd like to multiply by:"),
        10
      );
      this.value = this.value * otherValue;
    },
    ["/"]() {
      const otherValue = parseInt(
        prompt("Enter the number you'd like to divide by:"),
        10
      );
      this.value = this.value / otherValue;
    },
    increment() {
      this.value = this.value.valueOf() + 1;
    },
    decrement() {
      this.value = this.value.valueOf() - 1;
    },
    set() {
      this.value = parseInt(prompt("Set value"), 10);
    },
  };

  constructor(value) {
    super(value, NumberMorph.actions);
  }

  isEqual(other) {
    return other instanceof NumberMorph && this.value === other.value;
  }
}
MorphFactory.register("number", NumberMorph, {
  predicate: (value) => typeof value === "number",
});

export class StringMorph extends ActiveDOMMorph {
  static actions = {
    toUpperCase() {
      this.value = this.value.toUpperCase();
    },
    toLowerCase() {
      this.value = this.value.toLowerCase();
    },
  };

  constructor(value) {
    super(value, StringMorph.actions);
  }

  isEqual(other) {
    return other instanceof StringMorph && this.value === other.value;
  }
}
MorphFactory.register("string", StringMorph, {
  predicate: (value) => typeof value === "string",
});

export class ObjectEntryMorph extends DOMMorph {
  #name;

  constructor(name, value) {
    super(value);
    this.#name = name;
    this.add(Morph.of(value));
  }

  render(parentElement) {
    const row = document.createElement("tr");

    const head = document.createElement("th");
    head.innerText = this.#name;
    row.append(head);

    const cell = document.createElement("td");
    this.children[0].render(cell);
    row.append(cell);

    parentElement.append(row);
  }

  toString() {
    return `#<${this.constructor.name} name=${print(this.#name)} value=${print(
      this.value
    )}>`;
  }

  print() {
    return `${this.#name}: ${this.children[0].print()}`;
  }
}

export class ObjectMorph extends DOMMorph {
  constructor(value) {
    super(value);
    this.addChildrenFrom(value);
  }

  addChildrenFrom(object) {
    Object.entries(object).forEach((entry) => {
      this.add(this.buildEntryMorph(entry));
    });
  }

  buildEntryMorph([name, value]) {
    return new ObjectEntryMorph(name, value);
  }

  render(parent) {
    console.debug("render", this.toString());
    if (this.isEmpty()) {
      this.renderEmpty(parent);
    } else {
      this.renderObject(parent);
    }
  }

  renderObject(parent) {
    const table = this.createElement("table", {
      class: ["table", "table-hover"],
    });
    this.containerElement = table;

    this.children.forEach((child) => {
      child.render(table);
    });

    parent.append(table);
  }

  renderEmpty(parent) {
    const element = this.createElement("p", { class: "text-muted" });
    this.containerElement = element;

    element.innerText = this.emptyMessage;
    parent.append(element);
  }

  get emptyMessage() {
    return "Empty Object";
  }

  isEmpty() {
    return Object.values(this.value).length === 0;
  }

  print() {
    return `{${this.children.map((child) => child.print()).join(", ")}}`;
  }
}
MorphFactory.register("object", ObjectMorph, {
  predicate: (value) =>
    value != null && typeof value === "object" && !Array.isArray(value),
});

export class ArrayMorph extends ObjectMorph {
  get emptyMessage() {
    return "Empty Array";
  }

  isEmpty() {
    return this.value.length === 0;
  }

  print() {
    return `[${this.children.map((child) => child.print()).join(", ")}]`;
  }
}
MorphFactory.register("array", ArrayMorph, {
  predicate: (value) => Array.isArray(value),
});

export class RecordMorph extends DOMMorph {
  #fields;

  constructor(record) {
    super(record);
    this.#fields = Object.keys(record);
    this.#fields.forEach((field) => {
      this.add(Morph.of(record[field]));
    });
  }

  get fields() {
    return this.#fields;
  }

  get(field) {
    const index = thid.#fields.indexOf(field);
    if (index < 0) return;

    return this.children[index];
  }

  render(parentElement) {
    const row = document.createElement("tr");

    this.children.forEach((child) => {
      const cell = document.createElement("td");
      child.render(cell);
      row.append(cell);
    });

    parentElement.append(row);
  }
}

export class RelationMorph extends ArrayMorph {
  addChildrenFrom(relation) {
    relation.forEach((entry) => {
      this.add(this.buildEntryMorph(entry));
    });
  }

  buildEntryMorph(record) {
    return new RecordMorph(record);
  }

  get fields() {
    return this.children[0].fields;
  }

  get emptyMessage() {
    return "Empty Relation";
  }

  renderObject(parent) {
    const table = this.createElement("table", {
      class: ["table", "table-hover", "table-striped"],
    });
    this.containerElement = table;

    const thead = this.createElement("thead");
    this.fields.forEach((field) => {
      const th = this.createElement("th");
      th.innerText = field;
      thead.append(th);
    });
    table.append(thead);

    const tbody = this.createElement("tbody");
    this.children.forEach((child) => {
      child.render(tbody);
    });
    table.append(tbody);

    this.renderContainer(parent);
  }

  print() {
    return `[${this.children.map((child) => child.print()).join(", ")}]`;
  }
}

function isRelation(array) {
  return (
    Array.isArray(array) &&
    Object.prototype.toString.call(array[0]) === "[object Object]" &&
    !(array[0] instanceof Morph)
  );
}

MorphFactory.register("relation", RelationMorph, {
  predicate: isRelation,
});

export class TimeMorph extends ActiveDOMMorph {
  print() {
    if (this.value == null) {
      return "-";
    }

    return `${this.fmtDate()} ${this.fmtTime()}`;
  }

  fmtDate() {
    const d = this.value;
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  }

  fmtTime() {
    const d = this.value;
    return `${d.getHours()}:${d.getMinutes()}:${d.getSeconds()}`;
  }
}
MorphFactory.register("time", TimeMorph, {
  predicate: (value) => value instanceof Date,
});

export class ErrorMorph extends DOMMorph {
  print() {
    return `Error: ${this.value.message}`;
  }

  create() {
    return this.createElement("div", { class: "text-danger" });
  }
}
MorphFactory.register("error", ErrorMorph, {
  predicate: (value) => value instanceof Error,
});

export class FunctionMorph extends DOMMorph {
  constructor(parameterMorphs, outputMorph) {
    super(undefined);
    this.parameterMorphs = parameterMorphs;
    this.outputMorph = outputMorph;
  }

  invoke() {
    throw new Error("should be implemented by subclass");
  }

  renderValue() {}

  get params() {
    return this.parameterMorphs.map((param) => param.value);
  }

  render(parent) {
    // this.value = this.invoke();
    this.outputMorph.render(parent);
    this.outputMorph.value = this.invoke();
    this.children[0] = this.outputMorph;
    this.children[0].render(parent);
    setInterval(() => {
      // this.value = this.invoke();
      this.children[0].value = this.invoke();
      this.children[0].render(parent);
    }, 1000);
  }

  print() {
    return "f(x)";
  }
}

export class NowMorph extends FunctionMorph {
  constructor() {
    super([], new TimeMorph(undefined));
  }

  invoke() {
    return new Date();
  }

  print() {
    return "now()";
  }
}

export class SumMorph extends FunctionMorph {
  constructor(numberMorphs) {
    super(numberMorphs, new NumberMorph(undefined));
  }

  invoke() {
    return this.params.reduce((sum, x) => sum + x, 0);
  }

  print() {
    return "sum()";
  }
}
