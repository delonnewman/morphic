import { Enumerable } from "./enumerable.mjs";
import { Sortable } from "./sortable.mjs";

const $ = globalThis;

export function validate(value, type) {
  if (!type(value)) {
    throw new TypeError(`${JSON.stringify(value)} is not a valid ${type}`);
  }
}

const IdentityEncoding = {
  decode(value) { return value },
  encode(value) { return value },
};

// Basics
export const Undefined = mixin((it) => it === undefined, IdentityEncoding);
export const Null = mixin((it) => it === null, IdentityEncoding);
export const Boolean = mixin((it) => typeof it === "boolean", IdentityEncoding);
export const Number = mixin((it) => typeof it === "number", IdentityEncoding);
export const BigInt = mixin((it) => typeof it === "bigint", IdentityEncoding);
export const String = mixin((it) => typeof it === "string", IdentityEncoding);
export const Symbol = (it) => typeof it === "symbol";
export const Function = (it) => typeof it === "function";

// Some higher order combinators
export const Not = (type) => (it) => !type(it);
export const Or =
  (...types) =>
  (it) =>
    types.some((t) => !!t(it));
export const And =
  (...types) =>
  (it) =>
    types.every((t) => !!t(it));

// Some useful classifications
export const Primitive = mixin(
  Or(Undefined, Null, Boolean, Number, String, BigInt, Symbol),
  IdentityEncoding
);
export const Any = mixin((_) => true, IdentityEncoding);
export const Literal = mixin(
  (literal) => (it) => it === literal,
  IdentityEncoding
);

// Optionality of value
export const Nil = mixin(Or(Undefined, Null), IdentityEncoding);
export const Nullish = Nil;
export const Optional = (type) => Or(type, Nil);

// Objects, methods and properties
export const Object = mixin(
  (it) => tag(it) === "[object Object]",
  IdentityEncoding
);

export const HasOwn = (...properties) => {
  const type = (it) => properties.every((p) => $.Object.hasOwn(it, p));
  type.properties = $.Object.freeze(properties);
  mixin(type, IdentityEncoding);
  return type;
};

// Includes inherited properties
export const HasProperties = (...properties) => {
  const type = (it) => properties.every((p) => it[p] !== undefined);
  type.properties = $.Object.freeze(properties);
  mixin(type, IdentityEncoding);
  return type;
};

export const RespondsTo = (...methods) => {
  const type = (it) => methods.every((m) => Function(it[m]));
  type.methods = $.Object.freeze(methods);
  return type;
};

export const Decodable = RespondsTo("decode");
export const Encodable = RespondsTo("encode");

function decodeWith(type, value) {
  return Decodable(type) ? type.decode(value) : value;
}

function encodeWith(type, value) {
  return Encodable(type) ? type.encode(value) : value;
}

const ShapeEncoding = {
  decode(object) {
    const newObj = {};
    for (const [name, value] of $.Object.entries(object)) {
      newObj[name] = decodeWith(this.schema[name], value);
    }
    return newObj;
  },
  encode(value) {
    const newObj = {};
    for (const [name, value] of $.Object.entries(value)) {
      newObj[name] = encodeWith(this.schema[name], value);
    }
    return newObj;
  },
};

export const HasShape = (schema) => {
  const type = (it) =>
    $.Object.entries(schema).every(([property, type]) => !!type(it[property]));

  type.schema = $.Object.freeze(schema);
  mixin(type, ShapeEncoding);

  return type;
};
mixin(HasShape, ShapeEncoding);

const EnumEncoding = {};

export const EnumOf = (schema) => {
  const index = $.Object.entries(schema).reduce(
    (index, [property, value]) => ({
      ...index,
      [property]: property,
      [value]: property,
    }),
    {}
  );

  const type = (it) => index[it] !== undefined;
  mixin(type, EnumEncoding);
  $.Object.entries(schema).forEach(([name, value]) => {
    type[name] = value;
    type[value] = name;
  });

  type.decode = function (value) {
    if (index[value] === undefined) {
      throw new TypeError(`failed to decode "${value}" with ${type}`);
    }
    return value;
  };

  type.encode = function (value) {
    if (index[value] === undefined) {
      throw new TypeError(`failed to encode "${value} with ${type}`);
    }
    return value;
  };

  return type;
};

// Higer-order type
export const Type = HasShape({
  decode: Optional(Function),
  encode: Optional(Function),
  call: Function,
});

// Collections
const ArrayEncoding = {
  decode(value) {
    return mixin(value, Sortable);
  },
  encode(value) {
    return value;
  },
};

export const Array = mixin((it) => Array.isArray(it), ArrayEncoding);
export const ArrayLike = mixin(
  (it) => Object(it) && Number(it.length),
  IdentityEncoding
);

export const ArrayOf = (type) => (it) =>
  Array(it) && it.every((value) => !!type(value));
mixin(ArrayOf, IdentityEncoding);

export const Map = (it) => tag(it) === "[object Map]";
export const MapOf = (keyType, valueType) => (it) =>
  Map(it) &&
  Array.from(it.keys()).every(keyType) &&
  Array.from(it.values()).every(valueType);

const MapEncoding = {
  decode(object) {
    return mixin(new $.Map($.Object.entries(object)), Enumerable);
  },
  encode(map) {
    const newObj = {};
    for (const [name, value] of map) {
      newObj[name] = value;
    }
    return newObj;
  },
};

mixin(Map, MapEncoding);
mixin(MapOf, MapEncoding);

export const Has =
  (...keys) =>
  (it) =>
    keys.every((k) => it.has(k));
export const HasKeys = (...keys) => And(Map, Has(...keys));
mixin(HasKeys, MapEncoding);

export const Set = (it) => tag(it) === "[Object Set]";
export const SetOf = (type) => (it) =>
  Set(it) && Array.from(it.values()).every(type);

const SetEncoding = {
  decode(value) {
    return mixin(new $.Set(value), Enumerable, Sortable);
  },
  encode(value) {
    return Array.from(value.values());
  },
};

mixin(Set, SetEncoding);
mixin(SetOf, SetEncoding);

export const Timestamp = (it) => tag(it) === "[object Date]";
Timestamp.decode = (value) => new Date(value);
Timestamp.encode = (value) => value.toString();

function tag(value) {
  return $.Object.prototype.toString.call(value);
}

function mixin(type, ...objects) {
  for (const object of objects) {
    $.Object.assign(type, object);
  }
  return type;
}
