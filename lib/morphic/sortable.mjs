export const Sortable = {
  sorted() {
    if (Array.isArray(this)) {
      return this.toSorted((a, b) => a.compare(b));
    } else {
      return Array.from(this).sort((a, b) => a.compare(b));
    }
  },
};
