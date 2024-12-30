import { Null } from './base.mjs';
import { Morph } from './core.mjs';

export const Symbols = {
  customInspect: Symbol.for('Morphic.customInspect')
};

export function capitalize(string) {
  const rest = string.slice(1, string.length).toLowerCase();
  return `${string[0].toUpperCase()}${rest}`;
}

export function hashCombine(seed, hash) {
  // a la boost, a la clojure
  seed ^= hash + 0x9e3779b9 + (seed << 6) + (seed >> 2)
  return seed
}

export function drop(array, count) {
  return array.slice(count, array.length);
}

export function booleanNumberCompare(boolean, number) {
  return boolean ? number === 1 : number === 0;
}

export function booleanStringCompare(boolean, string) {
  const lower = string.toLowerCase()
  return boolean
    ? lower === 'yes' || lower === '1' || lower === 'true'
    : lower === 'no' || lower === '0' || lower === 'false';
}

export function hashCode(value) {
  if (value == null) return 0;

  switch(typeof value) {
    case 'number':
      return value;
    case 'boolean':
      return value ? 1 : 0;
    case 'string':
      return stringHash(value);
  }

  if (Array.isArray(value)) {
    return arrayHash(value);
  }

  if (value instanceof Map) {
    return arrayHash(value.entries().toArray());
  }

  if (value instanceof Set) {
    return arrayHash(value.values().toArray());
  }

  return value.hashCode();
}

// A basic string hash
export function stringHash(str) {
  let code = 0;
  for (let i = 0; i < str.length; i++) {
    for (let j = str.length; j > 0; j--) {
      code += Math.pow(str.charCodeAt(i), j)
    }
  }
  return code;
}

export function arrayHash(array) {
  return array.reduce((hash, item) => hashCombine(hash, hashCode(item)));
}


// object coercion
export function objectOf(value) {
  if (value == null) return Null;

  return Object(value);
}

export function inspect(value) {
  return objectOf(value)[Symbols.customInspect]();
}

export function is_iterable(value) {
  if (value == null) {
    return false;
  }

  return typeof value === 'object' && typeof value[Symbol.iterator] === 'function';
}

export function is_data(value) {
  if (value == null) {
    return null;
  }

  if (typeof value !== 'object') {
    return true;
  }

  return value instanceof Array ||
    value instanceof Map ||
    value instanceof Set
}

export function to_data(value) {
  if (value == null) {
    return new Map();
  }

  if (is_data(value)) {
    return value;
  }

  if (is_iterable(value)) {
    return Array.from(value)
  }

  return new Map(Object.entries(value))
}

export function is_morphic(value) {
  if (value == null) {
    return false;
  }

  return value instanceof Morph || typeof value.morph === 'function';
}
