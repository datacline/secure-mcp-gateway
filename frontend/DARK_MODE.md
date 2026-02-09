# Dark Mode Implementation

## Overview

The frontend now supports **automatic** and **manual** dark mode across all pages with a **pure black background** (`#000000`).

## Features

✅ **Global Dark Mode**: Applied to all pages throughout the frontend  
✅ **Black Background**: Pure black (`#000000`) background in dark mode  
✅ **Automatic Detection**: Uses system preference via `prefers-color-scheme`  
✅ **Manual Toggle**: Can be controlled programmatically via `data-theme` attribute  
✅ **Smooth Transitions**: All color changes animate smoothly (0.3s)  
✅ **Consistent Theming**: Uses CSS custom properties (CSS variables)

## Color Palette

### Light Mode
```css
--bg: #f8fafc                    /* Page background */
--bg-secondary: #ffffff          /* Secondary background */
--bg-card: #ffffff               /* Card background */
--bg-hover: #f1f5f9              /* Hover states */
--text: #1e293b                  /* Primary text */
--text-secondary: #64748b        /* Secondary text */
--text-tertiary: #94a3b8         /* Tertiary text */
--border: #e2e8f0                /* Borders */
--border-hover: #cbd5e1          /* Border hover */
--input-bg: #ffffff              /* Input background */
--input-border: #e2e8f0          /* Input border */
```

### Dark Mode
```css
--bg: #000000                    /* Pure black background */
--bg-secondary: #0a0a0a          /* Near-black secondary */
--bg-card: #1a1a1a               /* Dark card background */
--bg-hover: #2a2a2a              /* Dark hover state */
--text: #f1f5f9                  /* Light text */
--text-secondary: #cbd5e1        /* Light secondary text */
--text-tertiary: #94a3b8         /* Light tertiary text */
--border: #2a2a2a                /* Dark borders */
--border-hover: #3a3a3a          /* Dark border hover */
--input-bg: #1a1a1a              /* Dark input background */
--input-border: #2a2a2a          /* Dark input border */
```

### Theme Colors (Constant)
```css
--primary: #A3D78A               /* Primary green accent */
--primary-dark: #8DC474          /* Darker primary green */
--secondary: #64748b             /* Secondary gray */
--success: #10b981               /* Success green */
--danger: #ef4444                /* Danger red */
--warning: #f59e0b               /* Warning orange */
```

## How It Works

### 1. Automatic Dark Mode (System Preference)

The app automatically detects your operating system's dark mode preference:

```css
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #000000;
    /* ... other dark mode colors ... */
  }
}
```

**To test:**
- **macOS**: System Preferences → General → Appearance → Dark
- **Windows**: Settings → Personalization → Colors → Choose your mode → Dark
- **Linux**: Depends on your desktop environment

### 2. Manual Dark Mode Toggle

You can programmatically control dark mode using the `data-theme` attribute:

```typescript
// Enable dark mode
document.documentElement.setAttribute('data-theme', 'dark');

// Enable light mode
document.documentElement.setAttribute('data-theme', 'light');

// Remove manual override (use system preference)
document.documentElement.removeAttribute('data-theme');
```

**Example: Creating a Dark Mode Toggle Component**

```tsx
import { useState, useEffect } from 'react';
import { Moon, Sun } from 'lucide-react';

export function DarkModeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Check current theme
    const current = document.documentElement.getAttribute('data-theme');
    setIsDark(current === 'dark');
  }, []);

  const toggleDarkMode = () => {
    const newTheme = isDark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    setIsDark(!isDark);
    
    // Optional: Save preference
    localStorage.setItem('theme', newTheme);
  };

  return (
    <button onClick={toggleDarkMode} className="dark-mode-toggle">
      {isDark ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  );
}
```

### 3. Persist User Preference

To remember the user's dark mode choice:

```typescript
// On app initialization (e.g., in App.tsx)
useEffect(() => {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme) {
    document.documentElement.setAttribute('data-theme', savedTheme);
  }
}, []);
```

## Pages with Dark Mode Support

All pages now support dark mode:

- ✅ **Dashboard** (`/dashboard`)
- ✅ **MCP Servers** (`/mcp-servers`)
- ✅ **MCP Server Detail** (`/mcp-servers/:name`)
- ✅ **Policies List** (`/policies`)
- ✅ **Policy View** (`/policies/:id`)
- ✅ **Policy Edit** (`/policies/:id/edit`)
- ✅ **Policy Create** (`/policies/new`)
- ✅ **Sidebar Navigation** (Layout component)

## Components Using Dark Mode

### Sidebar (Layout.tsx)
- Dark background in dark mode
- Light icons and text
- Adjusted borders

### Cards
- Dark card backgrounds (`#1a1a1a`)
- Light text for readability
- Subtle borders

### Inputs & Forms
- Dark input backgrounds
- Light borders
- Proper focus states

### Buttons
- Primary button: Green accent (`#A3D78A`) with black text
- Secondary buttons: Dark backgrounds with light text
- Proper hover states

### Tables
- Dark headers and rows
- Light text
- Adjusted borders

## Browser DevTools Testing

You can test dark mode without changing your system settings:

1. Open DevTools (F12)
2. Press `Cmd/Ctrl + Shift + P` to open command palette
3. Type "dark" and select "Emulate CSS prefers-color-scheme: dark"

## Customization

To adjust dark mode colors, edit `/frontend/src/index.css`:

```css
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #000000;              /* Change to your preferred dark background */
    --bg-card: #1a1a1a;         /* Change card background */
    /* ... other colors ... */
  }
}
```

## Best Practices

1. **Always use CSS variables** instead of hardcoded colors
2. **Test in both modes** during development
3. **Ensure contrast ratios** meet WCAG guidelines
4. **Use appropriate alpha values** for transparency
5. **Test with real content** to ensure readability

## Troubleshooting

### Dark mode not working?

1. Check if CSS variables are loaded: Open DevTools → Elements → `:root` → Styles
2. Verify `index.css` is imported in `main.tsx` or `App.tsx`
3. Clear browser cache and hard refresh (Cmd/Ctrl + Shift + R)

### Colors not changing?

Make sure you're using CSS variables, not hardcoded colors:

```css
/* ❌ Wrong */
background: #ffffff;
color: #000000;

/* ✅ Correct */
background: var(--bg-card);
color: var(--text);
```

### Images look too bright?

Add an overlay or filter for images in dark mode:

```css
@media (prefers-color-scheme: dark) {
  .image-container img {
    opacity: 0.9;
    filter: brightness(0.9);
  }
}
```

## Performance

- **No JavaScript required**: Dark mode works with pure CSS
- **No layout shifts**: Smooth transitions without re-rendering
- **Minimal overhead**: CSS variables are highly performant

## Future Enhancements

- [ ] Add dark mode toggle button in UI
- [ ] Persist user preference in localStorage
- [ ] Add system preference sync
- [ ] Add per-page theme overrides
- [ ] Add custom theme picker

## Related Files

- `/frontend/src/index.css` - Global CSS variables and dark mode definitions
- `/frontend/src/components/Layout.css` - Sidebar and layout styles
- `/frontend/src/pages/*.css` - Page-specific styles (all support dark mode)

---

**Version**: 1.0  
**Last Updated**: January 30, 2026
