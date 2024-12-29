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

# Object Declaration

```ruby
object Math
  def max(a, b)
    return a if a > b
    b
  end
end
```

