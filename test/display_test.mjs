import * as Morphic from "../lib/morphic.mjs";
const { display, Null, Symbols } = Morphic;

export class DisplayTest extends Morphic.TestCase {
  testString() {
    const encoded = "&#116;&#101;&#115;&#116;";
    this.assertEquals(
      encoded,
      display("test"),
      "encodes strings as HTML entities",
    );
  }

  testNull() {
    this.assertEquals("-", display(null), 'null is displayed as "-"');
    this.assertEquals("-", display(undefined), 'undefined is displayed as "-"');
    this.assertEquals("-", display(Null), 'Null is displayed as "-"');
  }

  testBoolean() {
    this.assertEquals("Yes", display(true), 'true is displayed as "Yes"');
    this.assertEquals("No", display(false), 'false is displayed as "No"');
  }

  testError() {
    const str = "Error: this is a test: stack";
    const error = new Error();
    error.message = "this is a test";
    error.stack = "stack";

    this.assertEquals(str, display(error), "formats errors");
  }

  testOthers() {
    const object = {
      [Symbols.customInspect]() {
        return "Hey!";
      },
    };

    this.assertEquals(
      "Hey!",
      display(object),
      "displays other objects with custom inspect method",
    );
  }
}
