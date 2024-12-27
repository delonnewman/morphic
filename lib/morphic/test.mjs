import { inspect } from './utils.mjs';

export class FailedTest {
  passed = false;
  bgColor = "border-danger";
  constructor(test, memo) {
    this.test = test;
    this.memo = memo;
  }

  get message() {
    return this.memo ?? this.test;
  }
}

export class PassedTest {
  bgColor = "border-success";
  passed = true;
  constructor(test, memo) {
    this.test = test;
    this.memo = memo;
  }

  get message() {
    return this.memo ?? this.test;
  }
}

export class ErroredTest {
  bgColor = "border-warning";
  passed = null;
  constructor(error) {
    this.error = error;
  }

  get message() {
    return `${this.error.name}: ${this.error.message}\n${this.error.stack}`;
  }
}

export class TestCase {
  #currentTest;
  #passed;
  constructor(name = this.constructor.name) {
    this.name = name;
    this.id = name.replace(/\W/g, "-").toLowerCase();
    this.assertions = [];
  }

  get passed() {
    if (this.#passed !== undefined) {
      return this.#passed;
    }

    const passing = this.assertions.every((a) => a.passed);
    if (passing) return (this.#passed = true);

    const errors = this.assertions.some((a) => a.passed === null);
    if (errors) return (this.#passed = null);

    return (this.#passed = false);
  }

  get bgColor() {
    if (this.passed) return "bg-success";
    if (this.passed === null) return "bg-warning";

    return "bg-danger";
  }

  prove() {
    if (this.setup) this.setup();
    const props = Object.getOwnPropertyNames(this.constructor.prototype).filter(
      (prop) => prop.startsWith("test"),
    );
    for (const prop of props) {
      try {
        this.#currentTest = prop;
        this[prop]();
      } catch (e) {
        if (e instanceof FailedTest || e instanceof PassedTest) {
          this.assertions.push(e);
        } else {
          this.assertions.push(new ErroredTest(e));
        }
      }
    }
    if (this.teardown) this.teardown();
  }

  assertEquals(a, b, memo) {
    if (a !== b) {
      const msg = `${inspect(a)} and ${inspect(b)} are not equal`;
      this.fail(memo ? `${memo} - ${msg}` : msg);
    }
    this.pass(
      memo ?? `${inspect(a)} and ${inspect(b)} are equal`,
    );
  }

  assert(value, memo = undefined) {
    if (value !== true) this.fail(memo);
    this.pass(memo);
  }

  fail(memo) {
    throw new FailedTest(this.#currentTest, memo);
  }

  pass(memo) {
    this.assertions.push(new PassedTest(this.#currentTest, memo));
  }
}
