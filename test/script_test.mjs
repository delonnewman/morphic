import * as Morphic from '../lib/morphic.mjs';
const { Dispatch, JavaScript, ParameterizedMessage, VariablyParameterizedMessage, Script } = Morphic;

export class ScriptTest extends Morphic.TestCase {
  testResults() {
    const script = Script.build();
    script.send(Dispatch.new(JavaScript, ParameterizedMessage.new('sum', 3, 4)));
    const result = script.run();

    this.assertEquals(7, result, 'results are returned from dispatch');
  }

  testSideEffects() {
    let called = false;
    const effect = () => { called = true; return 11; };
    const script = Script.build();
    script.send(Dispatch.new(effect, ParameterizedMessage.new('call')));
    const result = script.run();

    this.assert(called, 'side effects are perfomed');
    this.assertEquals(11, result, 'after side effects are performed results are returned');
  }

  testExtentions() {
    Dispatch.register_extension(VariablyParameterizedMessage.new('invoke'), (subject, message) => {
      return subject.apply(subject, message.to_arguments());
    });

    const script = Script.build();
    script.send(Dispatch.new((x) => x + 1, VariablyParameterizedMessage.new('invoke', 3)));
    const result = script.run();

    this.assertEquals(4, result, 'extentions dispatch messages to compatible objects');
  }
}

export class MessageTest extends Morphic.TestCase {
  testVariablyParams() {
    const object = {};
    const sum = VariablyParameterizedMessage.new('sum');

    object[sum.hashCode()] = function(...xs) {
      return JavaScript.sum(...xs);
    };

    const script = Script.build();
    script.send(Dispatch.new(object, ParameterizedMessage.new('sum', 3, 4)));
    const result = script.run();

    this.assertEquals(7, result, 'variably parameterized methods can be dispatched by parameterized messages');
  }
}
