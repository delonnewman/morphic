import { BaseObject } from './base.mjs';

export const JavaScript = {
  eval(code) {
    return eval?.(`"use strict";${code}`);
  },

  sum(...numbers) {
    if (!numbers.every((x) => typeof x === 'number')) {
      throw new Error('can only sum numbers');
    }
    return this.eval(numbers.join('+'));
  },
};
