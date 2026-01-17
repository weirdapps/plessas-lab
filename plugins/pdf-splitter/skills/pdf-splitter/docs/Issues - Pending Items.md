# Issues - Pending Items

**Project:** pdf-splitter skill
**Location:** `./`
**Created:** 2026-01-02
**Last Updated:** 2026-01-17
**Last Verified:** 2026-01-02

---

## Pending Items

### MEDIUM: README.md Missing

**Location:** Project root directory

**Issue:** The implementation plan (Section 2) specifies a README.md file should exist, but it is not present in the implementation.

**Plan Specification:**
```
SplitPdfTS/
├── ...
└── README.md                 # Usage documentation
```

**Resolution:** Create README.md with usage documentation as specified in the plan.

---

## Completed Items

### RESOLVED: Extra Dependencies Now Documented in Plan

**Location:** `package.json:23-29`

**Original Issue:** The implementation included `canvas` (^2.11.2) and `pdfjs-dist` (^4.0.379) as dependencies, which were NOT specified in the implementation plan.

**Resolution:** Updated `SplitPdf-NodeTS-Implementation-Plan.md` to document these as peer dependencies required by pdf-to-img v5. Updated Sections 3.2, 3.3, 3.4, 5.1, 9.3, and 11 to reflect this requirement.

**Date Resolved:** 2026-01-02

---

### RESOLVED: pdf-to-img Version Updated in Plan

**Location:** `package.json:27`

**Original Issue:** The plan specified `pdf-to-img: ^4.2.0` but the implementation uses `^5.0.0`.

**Resolution:** Updated the implementation plan to specify version ^5.0.0 throughout all relevant sections.

**Date Resolved:** 2026-01-02

---

## Verification Summary

| Item | Plan | Actual | Status |
|------|------|--------|--------|
| **Project Structure** | | | |
| src/index.ts | Yes | Yes | OK |
| src/splitPdf.ts | Yes | Yes | OK |
| src/splitToPdf.ts | Yes | Yes | OK |
| src/splitToPng.ts | Yes | Yes | OK |
| src/utils/fileUtils.ts | Yes | Yes | OK |
| package.json | Yes | Yes | OK |
| tsconfig.json | Yes | Yes | OK |
| split-pdf.sh | Yes | Yes | OK |
| README.md | Yes | No | MISSING |
| **Dependencies** | | | |
| commander | ^12.1.0 | ^12.1.0 | OK |
| pdf-lib | ^1.17.1 | ^1.17.1 | OK |
| pdf-to-img | ^5.0.0 | ^5.0.0 | OK |
| canvas | ^2.11.2 | ^2.11.2 | OK |
| pdfjs-dist | ^4.0.379 | ^4.0.379 | OK |
| **Configuration** | | | |
| tsconfig.json content | Plan spec | Matches | OK |
| split-pdf.sh content | Plan spec | Matches | OK |
| **Source Code** | | | |
| fileUtils.ts implementation | Plan spec | Matches | OK |
| splitToPdf.ts implementation | Plan spec | Matches | OK |
| splitToPng.ts implementation | Plan spec | Matches | OK |
| splitPdf.ts implementation | Plan spec | Matches | OK |
| index.ts implementation | Plan spec | Matches | OK |

---

*Document maintained as per project guidelines*
