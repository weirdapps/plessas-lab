# NBG Chart Specifications

## Chart Types Available

| Chart Type | Count in Template | Usage |
|------------|-------------------|-------|
| Bar Chart | 46 | Comparisons, rankings |
| Line Chart | 40 | Trends, time series |
| Doughnut Chart | 36 | Proportions, percentages |
| Pie Chart | 10 | Simple proportions |
| Area Chart | 2 | Cumulative trends |
| Waterfall Chart | 1+ | Financial flows, changes |

## Color Sequence

Use these colors in order for chart data series:

| Order | Hex | Name |
|-------|-----|------|
| 1 | `#00ADBF` | Cyan (primary) |
| 2 | `#003841` | Dark Teal |
| 3 | `#007B85` | NBG Teal |
| 4 | `#939793` | Medium Gray |
| 5 | `#BEC1BE` | Light Gray |
| 6 | `#00DFF8` | Bright Cyan |

### Additional Chart Colors
| Hex | Usage |
|-----|-------|
| `#B5B7B5` | Light gray series |
| `#F5F9F6` | Chart backgrounds |
| `#D9D9D9` | Neutral gray |
| `#00E2FC` | Highlight accent |

## Chart Style Settings

### General Settings
- **Style ID**: 102 (most common) or 2 (fallback)
- **Rounded Corners**: Off (`roundedCorners val="0"`)
- **Auto Title Deleted**: Yes (titles handled separately)
- **Data Labels**: Bold, 65% luminance text

### Doughnut/Pie Chart Settings
- Use scheme colors: accent1 through accent6
- `varyColors="1"` for multi-colored segments
- No 3D effects (`bubble3D val="0"`)
- **Hole size**: 50% for doughnut charts

### Bar Chart Settings
- **Direction**: Column (`barDir val="col"`) or Bar (`barDir val="bar"`)
- **Grouping**: Clustered (`grouping val="clustered"`)
- **Gap Width**: 30% (`barGapWidthPct: 30`)
- **Data Labels**: Show values, bold text

### Line Chart Settings
- **Grouping**: Standard (`grouping val="standard"`)
- **Line Width**: 25400 EMUs (2pt)
- **Markers**: None (`symbol val="none"`)
- **Line Cap**: Round
- **Smooth**: False (straight lines)

### Waterfall Chart Settings
- **Layout ID**: `waterfall`
- **Data Label Position**: Outside end (`pos="outEnd"`)
- **Font**: Aptos, 10pt for labels, 12pt bold for title
- **Title Color**: Accent 1 (Dark Teal)

## Chart Design Best Practices

### Clean, Minimal Charts
1. **Remove clutter**: Hide gridlines where possible
2. **Single focus**: Each chart communicates ONE key message
3. **Data labels**: Only show if they add value
4. **Legend**: Position at top or right, never obscuring data
5. **Colors**: Use max 3-4 colors per chart

### Supporting Key Messages
- Add callout boxes for insights (e.g., "+113% increase")
- Use annotations for policy changes or events
- Keep subtitle/description explaining the data context

### Layout Tips
- **Two-column**: Chart on left/right, insight callout opposite
- **Full-width**: For single, important chart with annotations
- **Bar charts**: Use `barGapWidthPct: 30` for clean spacing

## PptxGenJS Chart Configuration

```javascript
// NBG Chart color array (NO # prefix!)
const NBG_CHART_COLORS = [
  '00ADBF',  // Cyan (primary)
  '003841',  // Dark Teal
  '007B85',  // NBG Teal
  '939793',  // Medium Gray
  'BEC1BE',  // Light Gray
  '00DFF8',  // Bright Cyan
];

// Bar chart example
slide.addChart(pptx.charts.BAR, chartData, {
  x: 1, y: 1.5, w: 10, h: 4.5,
  chartColors: NBG_CHART_COLORS,
  showValue: true,
  valueFontFace: 'Aptos',
  valueFontSize: 10,
  valueFontBold: true,
  barGapWidthPct: 30,
  catAxisLabelFontFace: 'Aptos',
  catAxisLabelFontSize: 10,
  valAxisLabelFontFace: 'Aptos',
  valAxisLabelFontSize: 10,
});

// Doughnut chart example
slide.addChart(pptx.charts.DOUGHNUT, chartData, {
  x: 1, y: 1.5, w: 5, h: 4.5,
  chartColors: NBG_CHART_COLORS,
  holeSize: 50,
  showLabel: true,
  showPercent: true,
});

// Line chart example
slide.addChart(pptx.charts.LINE, chartData, {
  x: 1, y: 1.5, w: 10, h: 4.5,
  chartColors: NBG_CHART_COLORS,
  lineSize: 2,
  lineSmooth: false,
  showMarker: false,
});

// Pie chart example
slide.addChart(pptx.charts.PIE, chartData, {
  x: 1, y: 1.5, w: 5, h: 4.5,
  chartColors: NBG_CHART_COLORS,
  showLabel: true,
  showPercent: true,
});
```

## Table Specifications

### Default Table Style
- **Style ID**: `{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}`
- **Style Name**: "Medium Style 2 - Accent 1"
- **Border Width**: 1pt
- **Border Color**: White (#FFFFFF)

### Table Color Scheme
| Element | Color |
|---------|-------|
| Header Row | Dark Teal `#003841` with white text |
| Body Cells | 20% tint of `#003841` (light teal) |
| Alternating Rows | 40% tint of `#003841` |
| Borders | White `#FFFFFF` |
| Text | Dark Text `#202020` |

### Table Typography
| Element | Font | Size |
|---------|------|------|
| Header | Aptos Bold | 11pt |
| Cell text | Aptos | 10-11pt |
| Footnotes | Aptos | 8pt |

### PptxGenJS Table Configuration

```javascript
// NBG Table style
const nbgTableStyle = {
  fontFace: 'Aptos',
  fontSize: 10,
  color: '202020',
  margin: 0,
  border: { pt: 1, color: 'FFFFFF' },
  fill: { color: 'E6F0F1' },  // Light teal tint
};

// Header row style
const nbgTableHeaderStyle = {
  fontFace: 'Aptos',
  fontSize: 11,
  bold: true,
  color: 'FFFFFF',
  fill: { color: '003841' },
};

// Create table
slide.addTable(tableData, {
  x: 1, y: 1.5, w: 10,
  fontFace: 'Aptos',
  fontSize: 10,
  color: '202020',
  border: { pt: 1, color: 'FFFFFF' },
  fill: { color: 'E6F0F1' },
  colW: [2, 3, 2, 3],
  rowH: 0.5,
  align: 'left',
  valign: 'middle',
});
```

## Chart Combination Patterns

### Bar + Pie (side-by-side)
- Shared color palette
- Equal or 60/40 width split

### Multiple Bar Charts (grid)
- 2x or 4x grid layouts
- Consistent axis scaling across all charts

### Line + Supporting Data
- Chart with supporting metrics
- Text annotations for context

### Infographic + Chart
- Mixed visualization types
- Supporting data tables
- Text annotations

### Text + Chart (two-column)
- Text explanation in one column
- Chart in the other column
- 40/60 or 50/50 split
