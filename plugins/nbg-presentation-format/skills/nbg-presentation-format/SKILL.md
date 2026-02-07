---
name: nbg-presentation-format
description: Create presentations and visual assets following National Bank of Greece (NBG) corporate brand guidelines. Use when creating presentations in NBG format, generating NBG-styled icons, charts, or any visual content for National Bank of Greece.
---

# NBG Presentation Format Skill

## Purpose

Generate pixel-perfect presentations, slides, charts, and icons that match the National Bank of Greece corporate design system. Visual consistency with NBG brand guidelines is mandatory.

## Quick Reference

### Slide Dimensions (CRITICAL)
- **Width**: 12.192 inches (NOT standard 13.33")
- **Height**: 6.858 inches (NOT standard 7.5")
- **Aspect Ratio**: 16:9 (NBG custom dimensions)

### Primary Colors
| Name | Hex | Usage |
|------|-----|-------|
| Dark Teal | `#003841` | Titles, headings, icons |
| NBG Teal | `#007B85` | Primary brand, section numbers |
| Bright Cyan | `#00DFF8` | Primary accent, bullets |
| Off-white | `#F5F8F6` | Light backgrounds |
| Dark Text | `#202020` | Body text |

### Fonts
- **Primary**: Aptos (all weights)
- **Bullets**: Arial
- **Fallback**: Calibri, Tahoma

### Logo Placement
- **Position**: Bottom-left corner (x=0.34", y=5.9")
- **Greek logo**: 2.14" x 0.62" (preferred)
- **English logo**: 2.94" x 0.62"
- **Assets**: `~/.claude/nbg-template-assets/`

## Slide Creation Workflow

### Step 1: Set Up Presentation
```javascript
const PptxGenJS = require('pptxgenjs');
const pptx = new PptxGenJS();

// NBG custom dimensions (CRITICAL - do not use defaults)
pptx.defineLayout({ name: 'NBG_Custom', width: 12.192, height: 6.858 });
pptx.layout = 'NBG_Custom';
```

### Step 2: Apply NBG Styles
```javascript
const NBG = {
  colors: {
    darkTeal: '003841',
    teal: '007B85',
    brightCyan: '00DFF8',
    offWhite: 'F5F8F6',
    darkText: '202020',
    white: 'FFFFFF',
  },
  fonts: {
    primary: 'Aptos',
    bullet: 'Arial',
  },
  chartColors: ['00ADBF', '003841', '007B85', '939793', 'BEC1BE', '00DFF8'],
};
```

### Step 3: Use White Backgrounds
**IMPORTANT**: Always use white/light backgrounds unless specifically requested.
- Slide background: `#FFFFFF` or `#F5F8F6`
- Text color: `#202020` (body) or `#003841` (titles)

### Step 4: Add Logo
```javascript
slide.addImage({
  path: '~/.claude/nbg-template-assets/nbg-logo-gr.svg',
  x: 0.34, y: 5.9, w: 2.14, h: 0.62
});
```

## Slide Types

### Cover Slide
- Title: 48pt Aptos, Dark Teal
- Subtitle: 48pt Aptos, NBG Teal
- Location/Date at bottom

### Section Divider
- Section number: 60pt Aptos, NBG Teal (#007B85)
- Title: 60pt Aptos, Dark Teal (#003841)
- Format: "01", "02", "03" etc.

### Content Slide
- Title: 24pt Aptos, Dark Teal
- Body: 11-12pt Aptos, Dark Text (#202020)
- Bullets: Bright Cyan (#00DFF8)
- Text box margins: 0 on all sides

### Thank You Slide
- Large text: 60pt Aptos, Dark Teal
- Minimal design, white background

## Text Formatting Rules

### Font Sizes
| Element | Size |
|---------|------|
| Cover title | 48pt |
| Divider number | 60pt |
| Page title | 24pt |
| Body text | 11-12pt |
| Bullet L1 | 24pt |
| Bullet L2 | 20pt |
| Bullet L3 | 18pt |
| Footnotes | 8pt |

### Text Box Settings
**CRITICAL**: All text boxes must use zero margins:
```javascript
margin: 0  // or margin: [0, 0, 0, 0]
```

### Bullet Points
- Character: • (Unicode 2022)
- Font: Arial
- Color: Bright Cyan (#00DFF8)

## Charts

### Color Sequence (in order)
1. `#00ADBF` - Cyan (primary)
2. `#003841` - Dark Teal
3. `#007B85` - NBG Teal
4. `#939793` - Medium Gray
5. `#BEC1BE` - Light Gray
6. `#00DFF8` - Bright Cyan

### Chart Types Available
- Bar/Column charts
- Line charts
- Doughnut charts
- Pie charts
- Area charts
- Waterfall charts

### Best Practices
- Use max 3-4 colors per chart
- Remove unnecessary gridlines
- Position data labels at "outEnd"
- Legend at top or right

## Tables

### Table Style
- Header: Dark Teal (#003841) with white text
- Body cells: Light teal tint
- Borders: White (#FFFFFF), 1pt
- Font: Aptos, 10-11pt

## Icons

See `references/icons.md` for complete icon specifications.

### Icon Quick Reference
- **Canvas**: 64 x 64 px, viewBox="0 0 64 64"
- **Style**: Solid fill, no strokes (stroke-width="0")
- **Colors**:
  - Standard: `#003841` (Dark Teal)
  - On dark backgrounds: `#F5F8F6` (Off-white)
  - Accent: `#00DEF8` (Bright Cyan)
- **Design**: Simple geometric shapes, monochrome

## Detailed References

- **Icons**: See [references/icons.md](references/icons.md) for complete icon design specifications
- **Colors**: See [references/colors.md](references/colors.md) for full color palette
- **Charts**: See [references/charts.md](references/charts.md) for chart configurations
- **Layouts**: See [references/layouts.md](references/layouts.md) for slide layout catalog

## Template Files

- **EN Template**: `/Users/plessas/Downloads/Powerpoint - Version 1.0_EN.pptx`
- **GR Template**: `/Users/plessas/Downloads/Powerpoint - Version 1.0_GR.pptx`
- **Logo assets**: `~/.claude/nbg-template-assets/`

## Common Patterns

### Infographic Layouts
- **Numbered grid**: 3x3 items with numbers 1-9
- **Sequential steps**: "01", "02", "03" format
- **Funnel/process**: Converging stages
- **Timeline**: Month headers with date markers

### Two-Column Layout
Preferred for slides with charts/tables:
- Text/bullets in left column (40%)
- Chart/table in right column (60%)

### Status Colors (for tables/charts only)
| Status | Hex |
|--------|-----|
| Deep Red | `#CB0030` |
| Red | `#F60037` |
| Orange | `#FF7F1A` |
| Yellow | `#FFDC00` |
| Green | `#5D8D2F` |
| Bright Green | `#90DC48` |

### Segment Colors
| Segment | Hex |
|---------|-----|
| Business | `#0D90FF` |
| Corporate | `#73AF3C` |
| Premium | `#D9A757` |
| Private | `#AA0028` |

## Quality Checklist

Before completing any NBG presentation:
- [ ] Slide dimensions are 12.192" x 6.858" (not default)
- [ ] Background is white (#FFFFFF) or off-white (#F5F8F6)
- [ ] Titles use Dark Teal (#003841)
- [ ] Body text uses Dark Text (#202020)
- [ ] All text boxes have margin: 0
- [ ] Logo placed in bottom-left corner
- [ ] Font is Aptos (or Arial fallback)
- [ ] Section numbers use "01", "02" format with NBG Teal
- [ ] Charts use NBG color sequence
- [ ] Bullets use Bright Cyan (#00DFF8)
