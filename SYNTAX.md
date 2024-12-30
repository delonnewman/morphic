# Data

## Numbers

```ruby
1 # integer
1.3 # float?
1.3r # rational
1/4 # rational
1.3i # complex
1_000_000
10e-7
10E-5
10e3
10E4
```

## Strings

```ruby
'Literal'
"#{variable} interpolated"
```

## Characters

```ruby
?a # ASCII "a"
?\t # tab
?\n # newline
?tab
?newline
?uFFFF # unicode
```

## Keywords

```ruby
:keyword
```

## Regexp Literals

```ruby
/test/
```

## Collections

### Ranges

```ruby
1..10
1...10
```

### Lists

```perl
(1, 2, 3, 4)
```

### Vectors

```ruby
[1, 2, 3, 4]
```

### Maps

```ruby
{"a" => 1, "b" => 2}
{:a => 1, :b => 2}
{a: 1, b: 2}
```

### Pairs

```ruby
:a => 1
```

### Sets

```ruby
{1, 2, 3, 4}
```

# Sigils

Programmable quote syntax

## Strings

```ruby
%w(a list of words) # ("a", "list", "of", "words")
%w[a vector of words] # ["a", "vector", "of", "words"]
%w{a set of words} # ["a", "set", "of", "words"]
%W(a list of interpolated\ words) # ("a", "list", "of", "interpolated words")
%W[a vector of interpolated\ words] # ["a", "vector", "of", "interpolated words"]
%W{a set of interpolated\ words} # ["a", "set", "of", "interpolated words"]
```

## Regexp

```ruby
%r"\w+_test.zera"i # Regexp.String('\w+_test.zera', 'i')
```

## Keywords

```ruby
%k"a keyword" # => :"a keyword", Keyword.String("a keyword")
%k(a list of keywords) # (:a, :list, :of, :keywords)
%k[a vector of keywords] # [:a, :vector, :of, :keywords]
%k{a set of keywords} # {:a, :set, :of, :keywords}
```

## Syntax

```ruby
%s(class Test (def (test x) x))
```

## Command Objects

```ruby
%x"echo $PATH" # Command.String('echo $PATH')
%x(echo $PATH) # Command.List(('echo', '$PATH'))
%x[echo $PATH] # Command.Vector(['echo', '$PATH'])
```

# Callables

## Blocks

```ruby
(1..100).each do |i| 
  puts i
end

(1..100).map { it * 2 }
(1..100).reduce(0) { _1 + _2 }
(1..100).reduce(0, &:+)
```

## Lambdas

```ruby
-> { puts "hey!" }
->(x) { x }
```

# Message Dispatch

```ruby
a + b # binary message
!true # prefix message
35.feet # postfix message

[1, 2, 3].at: 0 # keyword message

true.if: { puts "Yes" } else: { puts "No" } # keyword message

Math.max(1, 2) # parameterized message

Math.sum(1, 2, 3) # variably parameterized message
```

# Method Declaration

```ruby
# these are new message types for the method declaration object

class TrueClass
  # prefix method
  def prefix:!
    false
  end
end

class Numeric
  # need a way to specify operator precedence (a general purpose meta data system would be ideal)
  ^{ precedence: 1 }
  def binary:-(other)
    Math.sum(self, Math.negate(other))
  end

  # binary method
  ^{ precedence: 1 }
  def binary:+(other)
    Math.sum(self, other)
  end

  ^{ precedence: 0 }
  def binary:*(other)
    Math.product(self, other)
  end

  ^{ precedence: 0 }
  def binary:/(other)
    Math.product(self, Math.inverse(other))
  end

  # postfix method
  def feet
    Measure.new(self, :feet)
  end
end
```

# Singleton Object Declaration

```ruby
module Math
  # The equivalent of "def self.max(a, b)" in Ruby
  def max(a, b)
    return a if a > b
    b
  end
end
```

# Quoting

## Symbols

```ruby
`Person`
```

## Messages

```ruby
send(get(`Math`), `max(1, 2)`) # => 2
send([1, 2, 3], `at: 0`) # => 1
```

# Scope, Definitions & Assignment

```ruby
$root_url = JavaScript.window.url # global dynamically scoped variable
# self.define_global(`$root_url`, JavaScript.window.url, { dynamic: true });
```

```ruby
MAX_COUNT = 100 # like Ruby a global constant
# self.define_global(`MAX_COUNT`, 100)
```

```ruby
class Person
  # self is the class definition body (evaluated when it is defined)
  # use meta data to specifiy slot options
  ^{ init_args: :keyword, access: :readonly } @name # define_slot(`@name`).set_meta({ init_args: :keyword, access: :readonly })
  ^{ init_args: :keyword, access: :readonly } @dob # define_slot(`@name`).set_meta({ init_args: :keyword, access: :readonly })

  def age
    # self is the method body script object (evaluated when it is called)
    today = Date.today # set: `today`, to: Date.today
    year  = today.year - @dob.year # set: `year`, to: get(`today`) - slot(`@dob`).value

    # return is a script method
    return year - 1 if today.month < @dob.month # (get(`today`).month < slot(`@dob`).value.month).if_true: { return(get(`year`) - 1  }
    return year     if today.month > @dob.month # (get(`today`).month > slot(`@dob`).value.month).if_true: { return(get(`year`)) }
    return year - 1 if today.day < @dob.day # (get(`today`).day < slot(`@dob`).value.day).if_true: { return(get(`year`) - 1) }

    year # return(get(`year`))
  end
end
```