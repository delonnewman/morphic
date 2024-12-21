import { Null } from './base.mjs';

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

export function isEmpty(col) {
  const size = col.length ?? col.size;
  if (size === 0) return true;

  return col.isEmpty();
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

// object coercion
export function objectOf(value) {
  if (value == null) return Null;

  return Object(value);
}

export function inspect(value) {
  return objectOf(value)[Symbols.customInspect]();
}
