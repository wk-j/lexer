# Hello from Lexer

This is a **test** markdown file for the *Lexer* viewer.

## Code Highlighting

Here's some Rust:

```rust
fn main() {
    let message = "Hello, Lexer!";
    println!("{}", message);
    
    for i in 0..10 {
        if i % 2 == 0 {
            println!("{} is even", i);
        }
    }
}
```

And some JavaScript:

```javascript
const app = {
  name: "Lexer",
  version: "0.1.0",
  render(content) {
    document.body.innerHTML = content;
  }
};
```

And Python:

```python
def fibonacci(n):
    """Generate fibonacci sequence up to n."""
    a, b = 0, 1
    while a < n:
        yield a
        a, b = b, a + b

for num in fibonacci(100):
    print(num)
```

## Tables

| Feature | Status |
|---------|--------|
| Markdown parsing | Done |
| Syntax highlighting | Done |
| File open/drop | Done |
| Dark theme | Done |

## Blockquotes

> "The best way to predict the future is to invent it."
> — Alan Kay

## Lists

- [x] Scaffold Tauri v2 project
- [x] Implement markdown parser
- [x] Add tree-sitter highlighting
- [x] Build dark theme CSS
- [ ] File watcher integration
- [ ] Helix keyboard navigation

## Links

This is an [external link](https://github.com) and a [heading anchor](#code-highlighting).

---

*End of test file.*
