import * as Morphic from "../lib/morphic.mjs";

export class AssertionsTest extends Morphic.TestCase {
  testFalse() {
    try {
      this.assert(false);
    } catch (e) {
      if (e instanceof Morphic.FailedTest) {
        this.pass("false assersions fail");
      }
    }
  }

  testTrue() {
    this.assert(true, "true assersions pass");
  }
}
