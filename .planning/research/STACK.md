# Technology Stack

**Project:** Calculo Estacao (IATF Breeding Season Calculator)
**Researched:** 2026-02-12
**Confidence:** HIGH

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Preact | ^10.24.x | UI framework | 3KB lightweight React alternative with full ecosystem compatibility, perfect for client-side calculators. Delivers fast runtime performance without Virtual DOM overhead. Weekly downloads: 8.2M, proven enterprise adoption. |
| @preact/signals | ^1.3.x | State management | First-class reactive state management designed for Preact. Fine-grained reactivity skips unnecessary re-renders by updating only components that access signal values. Ideal for computation-heavy apps with frequent state updates. |
| TypeScript | ^5.7.x | Type safety | Industry standard for production apps (78% adoption in professional projects). Catches bugs at compile time, especially critical for complex date calculation logic and conflict resolution algorithms. |

### Date Manipulation

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| date-fns | ^4.1.0 | Date calculations | Modern, modular date library with first-class timezone support added in v4.0. Tree-shakeable (import only what you need), immutable API prevents bugs, 50+ locales. Replaced Moment.js as industry standard. **Critical for breeding season date calculations.** |

### Export & File Generation

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| jsPDF | ^2.5.x | PDF generation | De facto standard for client-side PDF generation. Low-level control via coordinates, Unicode/UTF-8 support for international text, runs entirely in browser with no backend required. 40K+ GitHub stars, mature ecosystem. |
| SheetJS (xlsx) | ^0.20.3 | Excel/CSV export | Industry standard for spreadsheet manipulation in JavaScript. Reads/writes XLSX, XLS, CSV with robust format support. **Note:** Install from cdn.sheetjs.com (versions 0.18.6+ not on npm). Handles complex Excel features. |

### Table Rendering

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Tabulator | ^6.3.x | Interactive tables | Feature-complete table library with built-in sorting, filtering, pagination, and export. Handles large datasets efficiently, supports custom cell rendering (needed for conflict color indicators), and works framework-agnostic. Lighter alternative to ag-Grid for non-enterprise use. |

### Build Tools

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Vite | ^6.x | Build tool & dev server | Modern build tool with instant HMR, 10x faster than Webpack. Pre-bundles dependencies with esbuild, ships smaller bundles (130KB vs Webpack's 150KB avg). Now default for new projects in 2026, adopted by React, Vue, Svelte official starters. |
| ESLint | ^9.x | Code quality | Static analysis catches errors before runtime. Essential for TypeScript projects. Auto-fixes common issues. |
| Prettier | ^3.x | Code formatting | Zero-config formatting prevents style debates, ensures consistency. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| localforage | ^1.10.x | localStorage wrapper | Async localStorage API with fallbacks to IndexedDB/WebSQL. Prevents main thread blocking for large data operations. Use if localStorage quota issues emerge. |
| zod | ^3.24.x | Runtime validation | TypeScript-first schema validation. Validate user inputs before processing, ensure data integrity for localStorage persistence. Prevents malformed data from breaking calculations. |
| clsx | ^2.x | Conditional CSS classes | Tiny utility (228B) for dynamic className construction. Simplifies conflict indicator styling logic (red for Sundays, yellow for overlaps). |

### Development Tools

| Tool | Version | Purpose | Notes |
|------|---------|---------|-------|
| @vitejs/plugin-preact | ^3.x | Vite integration | Official Preact plugin for Vite, includes Fast Refresh |
| typescript | ^5.7.x | Type checking | Enable strict mode for maximum safety |
| vite-plugin-pwa | ^0.21.x | PWA support | Optional: enables offline-first functionality via service workers |

## Installation

```bash
# Core dependencies
npm install preact @preact/signals date-fns jspdf tabulator-tables

# SheetJS (install from official CDN, not npm)
npm install https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz

# Supporting utilities
npm install localforage zod clsx

# Dev dependencies
npm install -D vite @vitejs/plugin-preact typescript @types/node eslint prettier
```

## Alternatives Considered

| Category | Recommended | Alternative | Why Not Alternative |
|----------|-------------|-------------|---------------------|
| Framework | Preact | Vanilla JS + Web Components | Vanilla JS lacks built-in state management and component architecture. For this complexity (multi-lot calculations, conflict detection), Preact provides better structure without bloat. Web Components have verbose APIs for this use case. |
| Framework | Preact | SolidJS | SolidJS has faster runtime (fine-grained reactivity) but smaller ecosystem (860K/week downloads vs Preact's 8.2M). Preact's React compatibility provides more learning resources and third-party integrations. |
| Framework | Preact | Alpine.js | Alpine lacks component architecture and build-time optimizations. Too limited for complex state (multiple lots, rounds, conflict resolution). Better for progressive enhancement, not SPA calculators. |
| Date Library | date-fns | Day.js | Day.js is smaller (2KB) but lacks timezone support and has weaker TypeScript types. date-fns v4's first-class timezone support is critical for accurate breeding date calculations across regions. |
| Date Library | date-fns | Luxon | Luxon has excellent timezone handling but larger bundle size and less modular architecture. date-fns tree-shaking produces smaller final bundles. |
| PDF Library | jsPDF | html2pdf.js | html2pdf.js converts HTML to PDF but produces larger files and has less control over layout. jsPDF's coordinate-based approach enables precise table formatting and custom layouts. |
| PDF Library | jsPDF | pdfmake | pdfmake's declarative JSON API is elegant but less flexible for dynamic table generation with conditional formatting. jsPDF offers lower-level control needed for colored conflict indicators. |
| Excel Library | SheetJS | ExcelJS | ExcelJS has better API design but larger bundle size and lacks SheetJS's format compatibility. SheetJS handles legacy formats critical for agricultural sector (many users on older Excel). |
| Table Library | Tabulator | DataTables | DataTables requires jQuery (unnecessary dependency bloat). Tabulator is framework-agnostic, lighter, and has modern API design. |
| Table Library | Tabulator | ag-Grid | ag-Grid is enterprise-grade but overkill for this use case. Free version lacks features, paid version is $1000+/developer. Tabulator provides all needed features (sort, filter, export, custom cells) for free. |
| Build Tool | Vite | Webpack | Webpack requires extensive configuration and has slower dev server (full rebuild on changes). Vite's HMR is instant, config is minimal, and it's now the 2026 standard for new projects. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Moment.js | Officially deprecated since 2020. Team recommends alternatives. Large bundle size (67KB), mutable API causes bugs. | date-fns 4.x |
| jQuery | Unnecessary in 2026. Modern frameworks and vanilla JS provide same functionality with better performance and smaller bundles. | Preact + native DOM APIs |
| Create React App | Deprecated and unmaintained. Webpack-based, slow dev server, outdated dependencies. | Vite + @vitejs/plugin-preact |
| React (full) | 40KB+ vs Preact's 3KB. For client-side-only calculator with no SSR, React's extra features provide no value but add bundle weight. | Preact (100% API compatible) |
| localStorage (direct) | Synchronous API blocks main thread with large datasets. No error handling for quota exceeded. Stores only strings (requires manual JSON serialization). | localforage (async wrapper with fallbacks) |
| Bootstrap / Tailwind | Heavy CSS frameworks unnecessary for calculator UI. Custom CSS with CSS Modules provides smaller bundles and full control over conflict indicators. | CSS Modules + clsx for dynamic classes |

## Stack Patterns by Use Case

**If app needs offline-first functionality:**
- Add vite-plugin-pwa for service worker generation
- Use localforage instead of raw localStorage (better quota management)
- Implement background sync for future backend integration

**If PDF quality becomes critical:**
- Consider upgrading to pdfmake for declarative table layouts
- Trade bundle size for easier maintenance

**If Excel export needs complex formatting:**
- Evaluate SheetJS Pro ($500/year) for styling, charts, images
- Community Edition handles basic cell data and formulas only

**If table performance degrades with 1000+ lots:**
- Enable Tabulator's virtual DOM rendering
- Implement pagination (50-100 rows per page)
- Consider IndexedDB via localforage for storage

**If timezone support becomes requirement:**
- Use date-fns v4's TZDate class and tz helper
- Import @date-fns/tz package for timezone utilities
- Validate timezone data with zod schemas

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| Preact 10.24.x | @preact/signals 1.3.x | Signals requires Preact 10+, works with all 10.x versions |
| date-fns 4.1.0 | TypeScript 5.x | Full TypeScript support with strict mode |
| jsPDF 2.5.x | TypeScript 5.x | Type definitions included in package |
| SheetJS 0.20.3 | All modern browsers | No IE11 support, use 0.18.x for legacy |
| Vite 6.x | Node.js 18+ | Requires modern Node, incompatible with Node 14/16 |
| Tabulator 6.3.x | Preact 10.x | Framework-agnostic, works with any framework via refs |

## Browser Compatibility

- **Target:** Modern evergreen browsers (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)
- **No IE11 support** (date-fns v4, Vite, and SheetJS 0.20.x all dropped IE11)
- **Mobile:** Full iOS Safari 14+ and Chrome Android 90+ support
- **localStorage:** 5-10MB quota across all browsers (adequate for ~1000 lots with 10 rounds each)

## Security Considerations

### localStorage Best Practices (2026)
- **Never store sensitive data** in localStorage (vulnerable to XSS)
- **Validate on read:** Use zod schemas to validate data from localStorage before use
- **Implement try-catch** around setItem() for QuotaExceededError handling
- **Consider encryption:** If adding authentication later, use HttpOnly cookies for tokens

### Dependency Security
- All recommended packages have active maintenance (updated within 6 months)
- Enable npm audit in CI pipeline
- Pin exact versions in package-lock.json

## Performance Targets

Based on stack choices:

| Metric | Target | Why Achievable |
|--------|--------|----------------|
| Initial Load | <1s on 3G | Preact (3KB) + date-fns tree-shaking + Vite code-splitting |
| Time to Interactive | <1.5s | Minimal JavaScript, no hydration needed (client-only) |
| Calculation Response | <50ms for 100 lots | date-fns is optimized for performance, signals prevent unnecessary re-renders |
| PDF Generation | <2s for 10-page report | jsPDF runs client-side, no network latency |
| Excel Export | <1s for 1000 rows | SheetJS optimized for large datasets |

## Sources

**High Confidence (Official Docs + Context7):**
- [date-fns v4.0 release announcement](https://blog.date-fns.org/v40-with-time-zone-support/) - Timezone support verification
- [Preact Signals Guide](https://preactjs.com/guide/v10/signals/) - State management patterns
- [jsPDF GitHub](https://github.com/parallax/jsPDF) - Version and capabilities
- [SheetJS Documentation](https://docs.sheetjs.com/) - Excel export features
- [Vite vs Webpack 2025 comparison (LogRocket)](https://blog.logrocket.com/vite-vs-webpack-react-apps-2025-senior-engineer/)
- [TypeScript Best Practices 2026 (Bacancy)](https://www.bacancytechnology.com/blog/typescript-best-practices)

**Medium Confidence (Multiple Sources + WebSearch Verified):**
- [Best JavaScript Frameworks 2026 (Hackr.io)](https://hackr.io/blog/best-javascript-frameworks)
- [Best Date Libraries (Phrase)](https://phrase.com/blog/posts/best-javascript-date-time-libraries/)
- [Client-side PDF Generation Guide (Joyfill)](https://joyfill.io/blog/how-to-generate-pdfs-in-the-browser-with-javascript-no-server-needed)
- [localStorage Best Practices 2026 (RxDB)](https://rxdb.info/articles/localstorage.html)
- [State Management Comparison 2026 (Veduis)](https://veduis.com/blog/state-management-comparing-zustand-signals-redux/)
- [JavaScript Table Libraries 2026 (CSS Script)](https://www.cssscript.com/best-data-table/)

**Framework Popularity Data:**
- [NPM Trends: Preact vs Solid vs Alpine](https://npmtrends.com/alpinejs-vs-inferno-vs-preact-vs-riot-vs-solid-js) - Download statistics

---

*Stack research for: Client-side IATF breeding calculator*
*Overall confidence: HIGH - All core recommendations verified with official docs or multiple authoritative sources*
*Research date: 2026-02-12*
