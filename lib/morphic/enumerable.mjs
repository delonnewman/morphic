export const Enumerable = {
  map(fn) {
    return this.reduce((array, item) => {
      array.push(fn(item));
      return array;
    }, []);
  },

  filter(fn) {
    return this.reduce((array, item) => {
      if (fn(item)) array.push(item);
      return array;
    }, []);
  },

  find(fn) {
    for (const item of this) {
      if (fn(item)) return item;
    };
    return undefined;
  },

  reduce(fn, init = undefined) {
    let memo = init;
    for (const item of this) {
      if (!init) {
        memo = item
        continue;
      } else {
        memo = fn(memo, item);
      }
    }
    return memo;
  },

  toArray() {
    return Array.from(this);
  },
};
