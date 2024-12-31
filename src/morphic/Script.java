package morphic;

class Script {
    private Binding binding;
    private ExecutionContext context;

    Script(Binding binding, ExecutionContext context) {
        this.binding = binding;
        this.context = context;
    }

    getBinding() {
        return binding;
    }

    self() {
        return binding.self();
    }

    get(String name) {
        return binding.get(name);
    }

    set(String name, Object value) {
        binding.set(name, value);
        return value;
    }
}