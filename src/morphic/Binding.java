package morphic;

class Binding {
    private Binding parent;
    private Map<String, Object> variables;
    private Map<String, Object> meta;

    public Binding(Binding parent) {
        this.parent = parent;
        this.variables = new HashMap<>();
        this.meta = new HashMap<>();
    }

    child() {
        return new Binding(this);
    }

    isGlobal() {
        return parent == null;
    }

    public Object self() {
        return get("self");
    }

    public Object get(String name) {
        if (variables.containsKey(name)) {
            return variables.get(name);
        } else if (parent != null) {
            return parent.get(name);
        } else {
            throw new RuntimeException("Variable " + name + " not found");
        }
    }

    public Binding setGlobal(String name, Object value) {
        if (isGlobal()) {
            return set(name, value);
        } else {
            return parent.setGlobal(name, value);
        }
    }

    public Binding set(String name, Object value) {
        return set(name, value, null);
    }

    public Binding set(String name, Object value, Map<String, Object> meta) {
        variables.put(name, value);
        if (meta != null) {
            this.meta.put(name, meta);
        }
        return this;
    }
}