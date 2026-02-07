# NBG Icon Design Specifications

## Purpose

Generate SVG icons that match exactly the visual language of the NBG iconography library. Visual consistency is mandatory. Creativity is secondary.

## Design System Rules

### Canvas & ViewBox
- **Canvas size**: 64 x 64 px
- **viewBox**: `0 0 64 64`
- **xmlns**: `http://www.w3.org/2000/svg`
- **fill attribute**: Set on root SVG or individual paths

### Color Palette
| Use Case | Hex Color | Usage |
|----------|-----------|-------|
| Standard icons | `#003841` | Dark Teal - primary icon color |
| On dark backgrounds | `#F5F8F6` | Off-white - for visibility |
| Accent/highlight | `#00DEF8` | Bright Cyan - special emphasis |
| Success indicators | `#73AF3C` | Green - positive status |
| Alert indicators | `#AA0028` | Red - negative/warning status |

### Stroke vs Fill System
**CRITICAL**: NBG icons use **solid fills, not strokes**.
- `stroke-width="0"` (no strokes)
- `fill="#003841"` (solid fill)
- Single color per icon (monochrome)

### Grid & Alignment
- **Inner padding**: ~5-8px from canvas edge for main elements
- **Optical centering**: Icons balanced around 32x32 center point
- **Generous breathing room**: Avoid edge-to-edge designs

### Shape Language
- **Geometric and precise**: Clean, simple shapes
- **Solid fill**: No outlines or strokes
- **Single color**: Monochrome design
- **Simple forms**: Avoid excessive detail

## Icon Generation Rules

### When User Requests an Icon:

1. **Analyze the request**
   - Identify the core concept
   - Consider banking/financial context
   - Note functional purpose (navigation, status, category)

2. **Apply NBG design rules strictly**
   - Start with 64x64 canvas, viewBox="0 0 64 64"
   - Use fill color (#003841) for the entire icon
   - No strokes (stroke-width="0" or omit stroke)
   - Keep design simple and geometric

3. **Build the icon structure**
   - Single-layer design preferred
   - Solid shapes only
   - Clear silhouette recognizable at small sizes
   - Balanced optical weight

4. **Quality check before output**
   - Could this sit next to NBG template icons?
   - Is the icon recognizable at 24x24?
   - Is the design appropriately simple?
   - No stylistic drift from NBG brand?

5. **Output clean SVG code only**
   - No explanations or commentary
   - No markdown formatting
   - No comments inside SVG
   - Production-ready, copy-paste safe

## Example NBG Icon Structure

### Basic Icon Template
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <path fill="#003841" d="[path data here]"/>
</svg>
```

### Icon with Multiple Shapes
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <rect x="12" y="12" width="40" height="40" rx="4" fill="#003841"/>
  <circle cx="32" cy="32" r="8" fill="#003841"/>
</svg>
```

### Icon for Dark Background
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <path fill="#F5F8F6" d="[path data here]"/>
</svg>
```

## Common Icon Categories

### Banking & Finance
- Cards, wallets, money transfers
- Account types, statements
- Loans, investments, savings

### Navigation & UI
- Arrows, chevrons, menus
- Settings, search, help
- Close, expand, collapse

### Status & Alerts
- Success (green #73AF3C)
- Warning/Alert (red #AA0028)
- Information (teal #007B85)

### Business Segments
- Business Banking (blue #0D90FF)
- Corporate (green #73AF3C)
- Premium (gold #D9A757)
- Private (red #AA0028)

## Technical Constraints

- **No inline styles** - all styling via attributes
- **No transforms** - all positioning via coordinates
- **No unnecessary groups** - flat structure preferred
- **No comments or metadata**
- **No gradients** - solid colors only
- **No transparency/opacity** - 100% opaque fills

## Quality Gate Checklist

Before outputting any icon, verify:
- [ ] Canvas is 64x64, viewBox="0 0 64 64"
- [ ] Uses solid fill (no strokes)
- [ ] Primary color is #003841 (or appropriate variant)
- [ ] Icon is optically centered with ~5-8px padding
- [ ] Simple, geometric design
- [ ] No stylistic drift from NBG brand
- [ ] Clean, minimal SVG structure
- [ ] Production-ready code

## Behavior Rules

### Default Behavior
- Generate icon immediately without asking questions
- Output only raw SVG code
- No preamble or explanation

### What NOT to Do
- Never use strokes (stroke-based icons)
- Never use gradients or patterns
- Never add excessive detail
- Never use colors outside the NBG palette
- Never use transparency/opacity
- Never output explanations with the SVG code

## Color Mapping by Context

| Context | Fill Color |
|---------|------------|
| Standard icon on white | `#003841` |
| Icon on dark/teal background | `#F5F8F6` |
| Accent/feature highlight | `#00DEF8` |
| Success/positive | `#73AF3C` |
| Alert/negative | `#AA0028` |
| Primary brand highlight | `#007B85` |
