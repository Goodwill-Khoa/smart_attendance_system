# BaseLayout Usage Guide

## Overview
`BaseLayout.jsx` is a reusable mobile-responsive base component that handles the common layout structure for all pages (header, content card, styling). This eliminates duplicate styling code and ensures consistent mobile responsiveness.

## Features
✅ Mobile-first responsive design with `clamp()` for fluid sizing  
✅ Automatic header with title and action buttons  
✅ Responsive content card wrapper  
✅ Built-in utility functions for inputs, buttons, grids  
✅ Single source of truth for responsive styles  

## Basic Usage

```jsx
import BaseLayout, { responsiveInputStyle, responsiveButtonStyle } from "../components/BaseLayout";

export default function MyPage() {
  return (
    <BaseLayout
      headerTitle="My Page Title"
      headerActions={[
        {
          label: "Logout",
          onClick: handleLogout,
          style: { background: "black", color: "white" }
        },
        {
          label: "Settings",
          onClick: handleSettings,
          style: { background: "white", color: "black", border: "1px solid #ccc" }
        }
      ]}
      maxWidth="700px"
    >
      {/* Your content goes here */}
    </BaseLayout>
  );
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | ReactNode | - | Main content to render inside the card |
| `headerTitle` | string | "" | Title text displayed in header |
| `headerActions` | array | [] | Array of button objects for header |
| `maxWidth` | string | "600px" | Max width of content card |
| `minHeight` | string | "80vh" | Min height of main area |
| `backgroundColor` | string | "rgba(0,0,0,0.2)" | Overlay background color |
| `cardStyle` | object | {} | Additional styles for content card |

## Header Actions Format

```javascript
const headerActions = [
  {
    label: "Home",
    onClick: () => navigate("/home"),
    style: {
      background: "black",
      color: "white",
      border: "none"
    },
    disabled: false  // optional
  }
];
```

## Utility Functions

### responsiveInputStyle
Use for all input and select fields:
```jsx
<input style={{ ...responsiveInputStyle }} />
<select style={{ ...responsiveInputStyle }} />
```

### responsiveButtonStyle(bgColor, textColor)
Use for buttons with custom colors:
```jsx
<button style={{ ...responsiveButtonStyle("#1f6f3f", "white") }}>
  Submit
</button>
```

### mobileGridStyle(minColWidth)
Use for responsive grids:
```jsx
<div style={{ ...mobileGridStyle("150px") }}>
  {items.map(item => <div key={item.id}>{item.name}</div>)}
</div>
```

### responsiveHeadingStyle & responsiveSubtextStyle
```jsx
<h2 style={{ ...responsiveHeadingStyle }}>My Title</h2>
<p style={{ ...responsiveSubtextStyle }}>Subtitle text</p>
```

## Refactoring Examples

### Example 1: StudentCourses.jsx

**Before:**
```jsx
return (
  <div style={{ minHeight: "100vh", ... }}>
    <div style={{ position: "absolute", ... }} />
    <div style={{ position: "relative", zIndex: 10 }}>
      <div style={{ display: "flex", ... }}>
        <div>Student Courses</div>
        <button>Logout</button>
      </div>
      <div style={{ display: "flex", ... }}>
        <div style={{ width: "100%", maxWidth: "600px", ... }}>
          {/* Content */}
        </div>
      </div>
    </div>
  </div>
);
```

**After:**
```jsx
import BaseLayout from "../components/BaseLayout";

const headerActions = [
  {
    label: "Logout",
    onClick: handleLogout,
    style: { background: "black", color: "white" }
  }
];

return (
  <BaseLayout
    headerTitle="Student Courses"
    headerActions={headerActions}
  >
    {/* Just your content */}
  </BaseLayout>
);
```

### Example 2: TeacherCourses.jsx

```jsx
import BaseLayout, { responsiveInputStyle, responsiveButtonStyle, mobileGridStyle } from "../components/BaseLayout";

const headerActions = [
  {
    label: "Change Password",
    onClick: () => navigate("/teacher-password"),
    style: { border: "1px solid #d1d5db", background: "white", color: "#111827" }
  },
  {
    label: "Logout",
    onClick: handleLogout,
    style: { background: "black", color: "white" }
  }
];

return (
  <BaseLayout
    headerTitle="Teacher Panel"
    headerActions={headerActions}
    maxWidth="700px"
  >
    <h2 style={{ textAlign: "center", marginBottom: "20px", fontSize: "clamp(20px, 4vw, 24px)" }}>
      Teacher Dashboard
    </h2>

    <div style={{ ...mobileGridStyle("150px") }}>
      <input
        value={newCourseName}
        placeholder="Course name"
        style={{ ...responsiveInputStyle }}
      />
      <select style={{ ...responsiveInputStyle }}>
        <option value="L">L</option>
        <option value="Pr">Pr</option>
      </select>
      <button style={{ ...responsiveButtonStyle("#1f6f3f", "white") }}>
        Add Course
      </button>
    </div>

    {/* Rest of content */}
  </BaseLayout>
);
```

## Migration Checklist

When refactoring a page:

- [ ] Remove the full background div structure
- [ ] Import `BaseLayout` and utility functions
- [ ] Create `headerActions` array
- [ ] Wrap content in `<BaseLayout>`
- [ ] Replace inline styles with utility functions
- [ ] Use `clamp()` for responsive sizing on remaining elements
- [ ] Test on mobile (Chrome DevTools)
- [ ] Verify header buttons render correctly
- [ ] Check that content is centered and responsive

## Testing on Mobile

1. Open Chrome DevTools (F12)
2. Click device toolbar icon
3. Select mobile device (e.g., iPhone 12)
4. Verify:
   - Header wraps properly
   - Buttons don't overflow
   - Content card is centered
   - Text is readable on small screens
   - Inputs/buttons scale appropriately

## Key Responsive Breakpoints

- `clamp(12px, 3vw, 20px)` - Padding
- `clamp(13px, 1.8vw, 16px)` - Font size for inputs
- `clamp(14px, 2vw, 16px)` - Button font size
- `clamp(18px, 4vw, 24px)` - Heading font size
- `clamp(8px, 1.5vw, 12px)` - Small padding

## Notes

- All `clamp()` values are mobile-first (starts small, grows with viewport)
- `vw` units adjust based on viewport width
- Use `box-sizing: "border-box"` on inputs/buttons
- Always test responsive design on actual mobile devices
- Consider using Firefox responsive design mode as well

## Pages to Refactor Next

1. ✅ **Login.jsx** - Already done
2. [ ] **StudentCourses.jsx**
3. [ ] **TeacherCourses.jsx**
4. [ ] **AdminDashboard.jsx**
5. [ ] **Scan.jsx**
6. [ ] **TeacherLogin.jsx**
7. [ ] **AdminLogin.jsx**
8. [ ] **TeacherPassword.jsx**
