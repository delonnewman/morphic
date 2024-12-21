import * as Morphic from "../lib/morphic.mjs";

export class DisplayTest extends Morphic.TestCase {
  testString() {
    this.assertEquals(
      "&#116;&#101;&#115;&#116;",
      Morphic.display("test"),
      "encodes strings as HTML entities",
    );
  }

  testNull() {
    this.assertEquals("-", Morphic.display(null), 'null is displayed as "-"');
    this.assertEquals(
      "-",
      Morphic.display(undefined),
      'undefined is displayed as "-"',
    );
    this.assertEquals(
      "-",
      Morphic.display(Morphic.Null),
      'Null is displayed as "-"',
    );
  }

  testBoolean() {
    this.assertEquals(
      "Yes",
      Morphic.display(true),
      'true is displayed as "Yes"',
    );
    this.assertEquals(
      "No",
      Morphic.display(false),
      'false is displayed as "No"',
    );
  }

  testError() {
    const str = "Error: this is a test: stack";
    const error = new Error();
    error.message = "this is a test";
    error.stack = "stack";

    this.assertEquals(str, Morphic.display(error), "formats errors");
  }

  testOthers() {
    const object = {
      [Morphic.Symbols.customInspect]() {
        return "Hey!";
      },
    };

    this.assertEquals(
      "Hey!",
      Morphic.display(object),
      "displays other objects with custom inspect method",
    );
  }
}
