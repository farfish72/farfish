# Custom React Hooks

This folder contains reusable React hooks for the FarFISH application.

## Available Hooks

### `useScrollToBottom`

Detects when the user has scrolled near the bottom of the page.

**Usage:**
```tsx
import { useScrollToBottom } from "../hooks/useScrollToBottom";

function MyComponent() {
  const isAtBottom = useScrollToBottom({ 
    threshold: 150,    // Show when 150px from bottom (default)
    debounceMs: 100    // Debounce scroll events by 100ms (default)
  });

  return (
    <div className={isAtBottom ? "visible" : "hidden"}>
      Content appears at bottom
    </div>
  );
}
```

**Features:**
- ✅ Debounced scroll listener for performance
- ✅ Passive event listeners
- ✅ Handles short pages (no scroll) automatically
- ✅ Responds to viewport resize
- ✅ Proper cleanup on unmount

**Options:**
- `threshold` (number): Distance from bottom in pixels to trigger visibility (default: 150)
- `debounceMs` (number): Debounce delay for scroll events (default: 100)

---

### `useScrollProgress`

Tracks scroll progress as a percentage (0-100).

**Usage:**
```tsx
import { useScrollProgress } from "../hooks/useScrollProgress";

function ScrollIndicator() {
  const progress = useScrollProgress({ debounceMs: 100 });

  return (
    <div className="progress-bar">
      <div style={{ width: `${progress}%` }} />
      <span>{progress}% scrolled</span>
    </div>
  );
}
```

**Features:**
- ✅ Returns 0-100 percentage value
- ✅ Debounced for performance
- ✅ Passive event listeners
- ✅ Handles edge cases (short pages, no scroll)
- ✅ Responds to viewport resize

**Options:**
- `debounceMs` (number): Debounce delay for scroll events (default: 100)

---

## Implementation Notes

### Performance Optimization
All hooks use:
- Debounced scroll handlers to reduce computation
- Passive event listeners for better scroll performance
- Proper cleanup to prevent memory leaks

### Browser Compatibility
These hooks work in all modern browsers and handle:
- Different scroll implementations (window.scrollY vs document.documentElement.scrollTop)
- Mobile viewport changes
- Dynamic content height changes

### TypeScript Support
All hooks are fully typed with TypeScript for better developer experience.
