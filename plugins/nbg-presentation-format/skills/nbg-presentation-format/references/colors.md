# NBG Complete Color Palette

## Theme Colors (NBG Colors 2)

### Core Theme Colors
| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| Dark 1 (Black) | `#000000` | 0, 0, 0 | Pure black text |
| Light 1 (White) | `#FFFFFF` | 255, 255, 255 | Backgrounds |
| Dark 2 (NBG Teal) | `#007B85` | 0, 123, 133 | Primary brand, headers |
| Light 2 (Off-white) | `#F5F8F6` | 245, 248, 246 | Light backgrounds |

### Accent Colors
| Accent | Hex | RGB | Usage |
|--------|-----|-----|-------|
| Accent 1 (Dark Teal) | `#003841` | 0, 56, 65 | Primary titles, headings |
| Accent 2 (NBG Teal) | `#007B85` | 0, 123, 133 | Section numbers, highlights |
| Accent 3 (Cyan) | `#00ADBF` | 0, 173, 191 | Secondary accents |
| Accent 4 (Bright Cyan) | `#00DFF8` | 0, 223, 248 | Feature accent, bullets |
| Accent 5 (Light Gray) | `#BEC1BE` | 190, 193, 190 | Subtle elements |
| Accent 6 (Medium Gray) | `#939793` | 147, 151, 147 | Secondary text |

## Primary Brand Colors

### Most Frequently Used
| Hex | Name | Usage | Frequency |
|-----|------|-------|-----------|
| `#00DFF8` | Bright Cyan | Primary accent | Very High (365+) |
| `#007B85` | NBG Teal | Brand color | Very High (814+) |
| `#047A85` | Teal Variant | Alternative teal | High (188+) |
| `#003841` | Dark Teal | Titles, icons | High (89+) |
| `#202020` | Dark Text | Body text | Medium |

### Extended Palette
| Hex | Name | Usage |
|-----|------|-------|
| `#00DEF8` | Bright Cyan Alt | Logo element (GR theme) |
| `#F5F9F6` | Light Background | Slide backgrounds |
| `#252D30` | Dark Charcoal | Dark backgrounds |
| `#0A091B` | Near-black | Dark slides |

## Secondary Colors (Charts & Diagrams)

| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| Black | `#212121` | 33, 33, 33 | Alternative text |
| Aqua Light | `#3EDEF8` | 62, 222, 248 | Light accent |
| Light Grey | `#BEC1BE` | 190, 193, 190 | Subtle elements |
| Grey | `#595959` | 89, 89, 89 | Secondary text |
| Pale Grey | `#F5F8F6` | 245, 248, 246 | Light backgrounds |

## Status/Semantic Colors

| Status | Hex | RGB | Usage |
|--------|-----|-----|-------|
| Success | `#73AF3C` | 115, 175, 60 | Positive indicators |
| Alert | `#AA0028` | 170, 0, 40 | Negative indicators |
| Gold | `#D9A757` | 217, 167, 87 | Premium accent |
| Blue | `#1E478E` | 30, 71, 142 | Information |

## Status Colors (Tables & Charts Only)

| Status | Hex | RGB | Usage |
|--------|-----|-----|-------|
| Deep Red | `#CB0030` | 203, 0, 48 | Critical/negative |
| Red | `#F60037` | 246, 0, 55 | Alert/warning |
| Orange | `#FF7F1A` | 255, 127, 26 | Caution |
| Yellow | `#FFDC00` | 255, 220, 0 | Attention |
| Green | `#5D8D2F` | 93, 141, 47 | Success |
| Bright Green | `#90DC48` | 144, 220, 72 | Strong positive |

## Segment/Division Colors

| Segment | Hex | RGB | Usage |
|---------|-----|-----|-------|
| Business | `#0D90FF` | 13, 144, 255 | Business banking |
| Corporate | `#73AF3C` | 115, 175, 60 | Corporate segment |
| Premium | `#D9A757` | 217, 167, 87 | Premium/private banking |
| Private | `#AA0028` | 170, 0, 40 | Private banking |

## Link Colors

| Type | Hex |
|------|-----|
| Hyperlink | `#0D90FF` |
| Followed Link | `#59C3FF` |

## Chart Color Sequence

Use these colors in order for chart data series:
1. `#00ADBF` - Cyan (primary)
2. `#003841` - Dark Teal
3. `#007B85` - NBG Teal
4. `#939793` - Medium Gray
5. `#BEC1BE` - Light Gray
6. `#00DFF8` - Bright Cyan

## Background Guidelines

### Light Theme (Preferred)
| Element | Color |
|---------|-------|
| Slide background | `#FFFFFF` or `#F5F8F6` |
| Title text | `#003841` |
| Body text | `#202020` |
| Accents | `#007B85` or `#00DFF8` |

### Dark Theme (Use Sparingly)
| Element | Color |
|---------|-------|
| Slide background | `#252D30` or `#003841` |
| Title text | `#FFFFFF` |
| Body text | `#F5F8F6` |
| Accents | `#00DFF8` |

## PptxGenJS Color Configuration

```javascript
// NBG Colors (no # prefix for PptxGenJS)
const NBG_COLORS = {
  // Primary Brand
  darkTeal: '003841',
  teal: '007B85',
  tealVariant: '047A85',
  cyan: '00ADBF',
  brightCyan: '00DFF8',
  brightCyanAlt: '00DEF8',

  // Neutrals
  black: '000000',
  darkText: '202020',
  charcoal: '252D30',
  mediumGray: '939793',
  lightGray: 'BEC1BE',
  offWhite: 'F5F8F6',
  offWhiteAlt: 'F5F9F6',
  white: 'FFFFFF',

  // Status
  success: '73AF3C',
  alert: 'AA0028',
  gold: 'D9A757',
  blue: '1E478E',

  // Links
  hyperlink: '0D90FF',
  followedLink: '59C3FF',
};

// Chart colors array
const NBG_CHART_COLORS = [
  '00ADBF', '003841', '007B85', '939793', 'BEC1BE', '00DFF8'
];
```

## Color Usage Quick Reference

| Purpose | Recommended Color |
|---------|------------------|
| Slide title | `#003841` (Dark Teal) |
| Body text | `#202020` (Dark Text) |
| Section numbers | `#007B85` (NBG Teal) |
| Bullet points | `#00DFF8` (Bright Cyan) |
| Primary accent | `#007B85` (NBG Teal) |
| Bright accent | `#00DFF8` (Bright Cyan) |
| Subtle elements | `#939793` (Medium Gray) |
| Light background | `#F5F8F6` (Off-white) |
| Icons | `#003841` (Dark Teal) |
