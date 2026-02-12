# Project Research Summary

**Project:** Calculo Estacao (IATF Breeding Season Calculator)
**Domain:** Client-side scheduling and date calculation web application
**Researched:** 2026-02-12
**Confidence:** HIGH

## Executive Summary

This is a client-side web calculator for beef cattle IATF (artificial insemination) breeding season scheduling. The domain has established tools (Excel-based planners from Iowa Beef Center, Beef Reproduction Task Force) that producers currently use, but these lack conflict detection and require Excel installation. The recommended approach is a lightweight Preact-based web app with date-fns for date calculations, Tabulator for table rendering, and jsPDF/SheetJS for exports. The architecture should follow layered design with pure business logic separated from UI, using immutable value objects for domain modeling and constraint satisfaction algorithms for conflict resolution.

Key risks center on JavaScript's notoriously broken Date API (month off-by-one errors, timezone interpretation bugs, month overflow) and performance degradation with multiple lots. These are mitigated by mandatory use of date-fns instead of native Date objects, implementing greedy conflict resolution algorithms instead of brute-force combinatorial search, and building performance optimization into the initial table implementation rather than retrofitting later. The architecture research strongly recommends CSP-based conflict resolution with iteration limits to prevent browser freezes.

The product differentiates from existing Excel planners through Sunday/weekend conflict detection, automatic lot overlap detection, and intelligent conflict resolution—features absent from current tools. It avoids scope creep by explicitly rejecting herd management features (individual animal tracking, financial tracking beyond protocol costs, multi-user collaboration) which would transform this into enterprise software competing with CattleMax/Farmbrite.

## Key Findings

### Recommended Stack

The stack prioritizes lightweight client-side execution with strong date handling capabilities. Preact (3KB) provides React compatibility without bloat, @preact/signals enables fine-grained reactivity for calculation-heavy apps, and TypeScript prevents bugs in complex date logic. date-fns v4.0+ is mandatory for timezone support and correct date arithmetic (month boundaries, leap years). Tabulator handles interactive tables with built-in sorting/filtering, while jsPDF and SheetJS (installed from CDN, not npm) handle PDF and Excel exports respectively. Vite provides instant HMR and modern build tooling.

**Core technologies:**
- **Preact 10.24.x**: UI framework — 3KB React alternative with full ecosystem compatibility, ideal for client-side calculators
- **date-fns 4.1.0**: Date calculations — Tree-shakeable, immutable API, first-class timezone support critical for breeding date accuracy
- **TypeScript 5.7.x**: Type safety — Catches bugs at compile time, essential for complex date calculation and conflict resolution logic
- **Tabulator 6.3.x**: Interactive tables — Framework-agnostic table library with sorting, filtering, custom cell rendering for conflict indicators
- **jsPDF 2.5.x + SheetJS 0.20.3**: Export generation — Client-side PDF/Excel export with no backend required

**Critical version notes:**
- SheetJS must be installed from cdn.sheetjs.com (versions 0.18.6+ not on npm)
- date-fns v4.0+ required for timezone support (v3.x lacks this)
- Vite 6.x requires Node.js 18+ (incompatible with older Node versions)

**What NOT to use:**
- Moment.js (deprecated 2020, mutable API causes bugs)
- Native JavaScript Date objects for arithmetic (month off-by-one errors, timezone bugs)
- jQuery (unnecessary in 2026)
- React full version (40KB vs Preact's 3KB for client-only app)
- CSV for Excel export (regional date formatting issues)

### Expected Features

Excel planners from Iowa Beef Center establish the feature baseline. Producers expect multiple protocol support (D0-D7-D9, D0-D8-D10, D0-D9-D11), multiple lot/group management (primiparous, secundiparous, multiparous, heifers), cost comparison between protocols, printable calendars for barn use, and supply list generation. These are table stakes—missing any creates incomplete product perception.

**Must have (table stakes):**
- Multiple protocol support (3 built-in protocols minimum)
- Date calculation with calendar output (eliminates manual calculation errors)
- Multiple lot/group management (5 standard cattle categories)
- Cost analysis/comparison (protocol selection justification)
- Printable calendar/reports (field use where digital access limited)
- Supply list generation (prevents under-ordering medications)

**Should have (competitive differentiators):**
- Conflict detection for Sundays/weekends (labor scheduling, vet availability)
- Intelligent conflict resolution (auto-stagger, interval adjustment)
- Lot overlap detection (prevents labor bottlenecks)
- Multiple rounds auto-scheduling (A1-A4 for year-long planning)
- iCalendar export (Google Calendar/Outlook integration)
- Mobile-responsive interface (producers work in field)
- Offline-first with local storage (unreliable farm connectivity)

**Defer to v2+:**
- Custom protocol builder (validate built-in protocols sufficient first)
- Additional protocols beyond 3 standard ones (wait for user requests)
- Advanced conflict resolution with interval adjustment (validate auto-stagger sufficient first)
- Native mobile app (web-responsive may suffice)
- Multi-season planning (scope says "one season at a time")

**Explicit anti-features (scope boundaries):**
- Full herd management system (competing with CattleMax/Farmbrite)
- Individual animal tracking (lot-based only, not animal IDs)
- Multi-user collaboration (adds auth, permissions, sync complexity)
- Cloud sync/backup (requires backend, accounts, data privacy compliance)
- Inventory management beyond supply lists
- Financial tracking beyond protocol costs
- Veterinary EMR features (health records, treatments)
- Breeding outcome tracking (pregnancy rates, calving success)

### Architecture Approach

Standard layered architecture with pure business logic core separated from UI framework dependencies. The domain model uses immutable value objects (Protocol, Lot, DateRange, Conflict) with encapsulated validation. Business logic layer contains pure functions for date calculation, conflict detection, and resolution. State management via Zustand with persist middleware handles centralized state and automatic localStorage sync. Persistence layer uses type-safe adapter pattern around localStorage with quota monitoring. Export generation operates as read-only transformation of state.

**Major components:**
1. **Date Engine** — Pure function: given D0 + protocol + intervals, compute all handling dates for a lot. Uses date-fns exclusively for date arithmetic to avoid native Date pitfalls.
2. **Conflict Detector** — Pure function: given array of lots with computed dates, identify Sunday conflicts and same-day overlaps using Set/Map for efficient lookups.
3. **Conflict Resolver** — CSP solver with backtracking: tries D0/interval combinations to find configuration minimizing conflicts. Must include iteration limit (10k max) to prevent browser freeze.
4. **State Management** — Zustand store with persist middleware holding lots, calculated dates, conflicts, UI state. Conflicts are derived state, not stored separately.
5. **Persistence Adapter** — Type-safe wrapper around localStorage with try-catch on all writes, quota monitoring, graceful degradation when quota exceeded.
6. **Export Generator** — Client-side PDF (jsPDF) and Excel (SheetJS) generation with proper date formatting and print CSS for usable layouts.

**Critical patterns:**
- **Layered architecture**: Domain → Core → State → UI, dependencies flow inward only
- **Immutable value objects**: Protocol, Lot, Conflict as immutable TypeScript classes
- **CSP solver with heuristics**: Greedy algorithm (sort by flexibility, assign conflicts last) not brute-force
- **Observer pattern**: State changes trigger persistence, recalculation via middleware
- **Adapter pattern**: Type-safe localStorage wrapper with validators

**Build order (dependency-driven):**
1. Domain model (no dependencies)
2. Date engine (depends on domain)
3. Basic state management (depends on domain)
4. Conflict detector (depends on date engine)
5. Basic UI (depends on state + date engine)
6. Persistence (depends on state)
7. Conflict resolver (depends on detector)
8. Auto-stagger (depends on resolver)
9. Export generation (depends on complete state model)

### Critical Pitfalls

Research identified 8 critical pitfalls with recovery costs ranging from LOW to HIGH:

1. **Month off-by-one errors** — JavaScript Date uses zero-indexed months (0=Jan, 11=Dec). Using `new Date(2026, 2, 1)` creates March 1 not February 1. Prevention: Always use date-fns, never construct dates with raw month numbers. Add unit tests for month boundaries. Recovery cost: MEDIUM (database migration + user notification).

2. **Timezone interpretation destroying date-only values** — `new Date("2026-01-01")` creates midnight UTC, causing dates to shift by one day for users in GMT-3 (Brazil). Prevention: Store dates as `{year, month, day}` objects, use date-fns `startOfDay()`, never use ISO strings for date-only values. Test in GMT-3 and GMT+2. Recovery cost: HIGH (cannot auto-fix, user intent unclear).

3. **Month overflow creating bizarre dates** — Adding 30 days to Jan 31 with `setDate(getDate() + 30)` produces wrong results. Prevention: Use date-fns `addDays()`, never use mutable Date arithmetic. Test Jan 31 + 1 month, Feb 28/29 + 1 day, Dec 31 + 1 day. Recovery cost: MEDIUM.

4. **Brute-force conflict resolution becomes exponential** — Trying all combinations of 5 lots × 4 rounds = 20! combinations freezes browser. Prevention: Use greedy heuristic (sort by flexibility, max ±7 day search), set 10k iteration limit, fail gracefully with message. Make manual resolution primary UI path. Recovery cost: LOW (add timeout, show message).

5. **localStorage quota exceeded kills all data** — User adds 5th lot, `QuotaExceededError` thrown, previous data potentially lost. Prevention: Wrap all `localStorage.setItem()` in try-catch, monitor quota usage, show warning at 80%, gracefully degrade to session-only storage. Recovery cost: LOW (clear old data, compress JSON, prompt export).

6. **Print CSS breaks PDF layout** — Table cut off mid-row, headers missing on page 2, colors disappear. Prevention: Create `@media print` styles with `page-break-inside: avoid`, `display: table-header-group` for headers, print-safe fonts. Test in Chrome, Firefox, Safari. Recovery cost: LOW (add print CSS).

7. **Excel export shows dates as numbers or text** — CSV export writes dates as strings, Excel shows "44927" (serial number) or "2026-01-01" (text). Prevention: Use XLSX format with SheetJS/ExcelJS, set column data type to Date, apply date number format. Never use CSV for date columns. Recovery cost: LOW (re-export using XLSX library).

8. **Table rendering kills performance at 100+ cells** — 5 lots × 4 rounds × 3 dates = 60 cells causes sluggish UI, input lag. Prevention: Use memoization (`React.memo`, `useMemo`), debounce conflict detection (300ms), virtualize tables >50 rows, limit initial render to 3 lots. Recovery cost: MEDIUM (add virtualization library).

**Phase-critical pitfalls:**
- **Phase 1 (Date Engine)**: Pitfalls #1, #2, #3 MUST be prevented (month errors, timezone bugs, overflow)
- **Phase 2 (Table UI)**: Pitfall #8 (performance degradation)
- **Phase 3 (Conflict Resolution)**: Pitfall #4 (exponential complexity)
- **Phase 4 (Persistence)**: Pitfall #5 (localStorage quota)
- **Phase 5 (Export)**: Pitfalls #6, #7 (print CSS, Excel dates)

## Implications for Roadmap

Based on research, suggested 6-phase structure following dependency graph from architecture:

### Phase 1: Foundation (Domain Model + Date Engine)
**Rationale:** Date engine has hardest technical constraints (must prevent pitfalls #1-3 before any calculation logic). Domain model has no dependencies, enables parallel development of state management. This phase establishes correct date handling patterns that all subsequent phases depend on.

**Delivers:**
- Immutable value objects (Protocol, Lot, DateRange, Conflict)
- Date calculation engine using date-fns exclusively
- Unit tests covering month boundaries, timezone handling, leap years

**Addresses:**
- Table stakes: Date calculation foundation
- Stack: TypeScript + date-fns integration established

**Avoids:**
- Pitfall #1: Month off-by-one errors (use date-fns constants)
- Pitfall #2: Timezone interpretation bugs (store as {year, month, day})
- Pitfall #3: Month overflow (use addDays(), never mutable Date)

**Verification:**
- Test: `addDays(new Date(2026, 0, 31), 1)` returns Feb 1 not Mar 3
- Test: Dates display identically in GMT-3 and GMT+2
- Test: Dec 31 + 1 day = Jan 1 next year

### Phase 2: Core UI (State + Table Visualization)
**Rationale:** State management enables UI development. Table rendering requires working state and date engine. Performance optimization must be built-in from start (pitfall #8), not retrofitted. This phase validates the core UX before adding complexity (conflicts, exports).

**Delivers:**
- Zustand store with lots state
- Interactive table (Tabulator) displaying lots and calculated dates
- Form inputs for D0, protocol selection, lot management
- Memoization for performance (React.memo, useMemo)
- Local storage persistence (defer to Phase 4 if testing shows it's not needed yet)

**Uses:**
- Preact for UI components
- @preact/signals for reactive state
- Tabulator for table rendering with custom cell formatting

**Implements:**
- State Management component (Zustand)
- UI Components layer (forms, tables)

**Avoids:**
- Pitfall #8: Table performance degradation (memoize from start, debounce inputs)

**Verification:**
- 60+ cells render without input lag (<50ms)
- Scrolling maintains 60fps
- Conflict detection debounced to 300ms

### Phase 3: Conflict Detection
**Rationale:** Conflict detection is the key differentiator vs Excel planners, but requires working date engine and table UI. Detection only (not resolution) validates the value proposition before investing in complex CSP solver.

**Delivers:**
- Sunday/weekend conflict detection
- Lot overlap detection (same-day conflicts between lots)
- Round spacing validation (min 22 days between rounds)
- Visual conflict indicators in table (red background, icons, tooltips)

**Addresses:**
- Differentiator: Conflict detection (Sundays + lot overlaps)
- Differentiator: Visual conflict indicators

**Implements:**
- Conflict Detector component (pure function using Set/Map)

**Verification:**
- Detects Sunday conflicts correctly
- Flags lot overlaps when same day used by multiple lots
- Shows clear visual indicators (color-coded cells)

**Research flag:** Standard pattern (scheduling conflict detection), skip research-phase

### Phase 4: Persistence
**Rationale:** Can be added to working UI without disrupting core functionality. Critical to implement quota monitoring and graceful degradation (pitfall #5) before release, as data loss is unacceptable.

**Delivers:**
- Type-safe localStorage adapter with validators
- Try-catch on all writes with QuotaExceededError handling
- Quota monitoring (warn at 80%, prevent save at 95%)
- Graceful degradation to session-only storage
- "Export to Excel" prompt when quota issues detected

**Uses:**
- localforage for async localStorage API (if quota issues emerge)
- zod for runtime validation of stored data

**Implements:**
- Persistence Adapter component

**Avoids:**
- Pitfall #5: localStorage quota exceeded (try-catch, quota monitoring, graceful degradation)

**Verification:**
- Fill localStorage to 95%, add data, app doesn't crash
- Shows clear error message with export prompt
- Works in private/incognito mode (localStorage may be disabled)

**Research flag:** Standard pattern (localStorage wrapper), skip research-phase

### Phase 5: Conflict Resolution
**Rationale:** Most complex algorithm (CSP solver), builds on Phase 3 detection. Greedy heuristic with iteration limits prevents pitfall #4 (exponential complexity). Manual resolution should be primary UX, automatic is enhancement.

**Delivers:**
- Manual conflict resolution UI (adjust D0 via form inputs)
- Greedy conflict resolver (sort by flexibility, limit search to ±7 days)
- Iteration limit (10k max) with timeout (2 seconds)
- Preview UI showing proposed changes before applying
- Clear messaging when auto-resolve fails

**Addresses:**
- Differentiator: Intelligent conflict resolution (auto-stagger)

**Implements:**
- Conflict Resolver component (CSP solver with backtracking)
- Auto-Stagger component (depends on resolver)

**Avoids:**
- Pitfall #4: Brute-force exponential complexity (greedy algorithm, iteration limit, timeout)

**Verification:**
- Add 5 lots with conflicts, resolution completes in <2 seconds
- Shows preview before applying changes
- Fails gracefully with message when impossible to resolve

**Research flag:** NEEDS RESEARCH — CSP algorithms for scheduling conflicts, constraint propagation techniques, heuristic optimization

### Phase 6: Export Generation
**Rationale:** Export is read-only operation on finalized state model. Requires complete calendar visualization and conflict detection to produce meaningful output. PDF and Excel exports have distinct pitfalls (#6, #7) requiring careful testing.

**Delivers:**
- PDF export with jsPDF (barn sheets, monthly calendars)
- Excel export with SheetJS (proper XLSX format with date columns)
- Print CSS for browser print functionality
- iCalendar (.ics) export for Google Calendar/Outlook integration

**Uses:**
- jsPDF for PDF generation with coordinate-based layout
- SheetJS (from cdn.sheetjs.com) for XLSX generation
- CSS @media print rules for print layouts

**Implements:**
- Export Generator component (PDF, Excel, CSV, iCalendar)

**Avoids:**
- Pitfall #6: Print CSS breaks (page-break-inside: avoid, repeat headers)
- Pitfall #7: Excel dates as text (use XLSX, set column type to Date)

**Verification:**
- Export 10-lot schedule to PDF, no cut-off rows
- Open exported XLSX in Excel, dates are sortable and formatted
- Print from browser produces usable barn sheets
- iCalendar import to Google Calendar shows correct dates

**Research flag:** Needs focused research on Excel date formatting and print CSS best practices

### Phase Ordering Rationale

**Dependency-driven order:**
- Phase 1 (Domain + Date Engine) has no dependencies, establishes date handling patterns
- Phase 2 (State + UI) depends on Phase 1 (domain model, date engine)
- Phase 3 (Conflict Detection) depends on Phase 2 (working table UI) and Phase 1 (date calculations)
- Phase 4 (Persistence) depends on Phase 2 (state management) but is parallel to Phase 3
- Phase 5 (Conflict Resolution) depends on Phase 3 (conflict detection)
- Phase 6 (Export) depends on Phases 2-3 (complete state model, calendar visualization)

**Risk mitigation:**
- Date pitfalls (#1-3) addressed in Phase 1 before any subsequent work
- Performance (pitfall #8) built into Phase 2 UI, not retrofitted
- Conflict resolution (pitfall #4) deferred to Phase 5 after detection validates value proposition
- localStorage (pitfall #5) isolated in Phase 4, can be disabled if issues arise
- Export pitfalls (#6-7) addressed last when data model stable

**Feature validation:**
- Phase 2 delivers MVP: protocol selection + date calculation + table view
- Phase 3 adds key differentiator (conflict detection) for user feedback
- Phase 5 enhances conflict features after validation
- Phase 6 achieves parity with Excel planner (export capabilities)

**Grouping logic:**
- Phase 1: Foundation (no UI, pure logic)
- Phase 2: Core UX (minimal viable interface)
- Phase 3: Differentiator (conflict detection)
- Phase 4: Data persistence (can be parallel to Phase 3)
- Phase 5: Advanced features (conflict resolution)
- Phase 6: Output generation (export parity)

### Research Flags

**Phases needing deeper research during planning:**
- **Phase 5 (Conflict Resolution):** CSP algorithms are complex domain. Needs research on constraint propagation, heuristic optimization, greedy vs branch-and-bound approaches. Sparse documentation for scheduling-specific CSP. Recommend `/gsd:research-phase` focused on job-shop scheduling algorithms and constraint satisfaction libraries (kiwi.js, csp.js).

**Phases with standard patterns (skip research-phase):**
- **Phase 1 (Foundation):** Domain-driven design with value objects is well-documented. date-fns documentation comprehensive.
- **Phase 2 (Core UI):** Zustand + Preact is standard stack, well-documented. Tabulator has thorough docs.
- **Phase 3 (Conflict Detection):** Straightforward Set/Map lookups for date collision detection.
- **Phase 4 (Persistence):** localStorage patterns well-established, quota handling documented in MDN.
- **Phase 6 (Export):** jsPDF and SheetJS have comprehensive docs, print CSS best practices available.

**Research confidence by phase:**
- Phase 1: HIGH (date-fns docs, DDD patterns)
- Phase 2: HIGH (framework docs, table library docs)
- Phase 3: MEDIUM (conflict detection logic, multiple sources)
- Phase 4: HIGH (MDN localStorage docs)
- Phase 5: MEDIUM-LOW (CSP algorithms, needs focused research)
- Phase 6: HIGH (library docs, export patterns)

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All core technologies verified with official docs (date-fns, Preact, Vite, jsPDF, SheetJS). Version compatibility confirmed. Alternative comparisons documented. |
| Features | MEDIUM | Based on Iowa Beef Center Excel planners (authoritative source) and herd management system comparisons. Conflict detection differentiator inferred from gap analysis, not explicitly requested in existing tools. |
| Architecture | MEDIUM | Layered architecture and domain-driven design are standard patterns. CSP solver approach for conflict resolution verified across multiple scheduling research papers. State management patterns (Zustand, immutability) well-documented. |
| Pitfalls | MEDIUM | Date API pitfalls extensively documented (recent 2026 analysis, multiple MDN sources). Conflict resolution complexity verified via NP-hard scheduling research. localStorage quota issues documented in MDN and error handling guides. |

**Overall confidence:** HIGH

### Gaps to Address

**Feature validation gaps:**
- Conflict detection is inferred differentiator (Excel planner doesn't mention it), not explicitly requested in domain sources. Validate with early user feedback that Sunday/weekend conflicts are actual pain point.
- Multiple rounds (A1-A4) mentioned as "standard" but not deeply validated. Confirm 4 rounds is typical, not just one Excel planner's default.
- Custom protocol builder deferred to v2+, but unclear if built-in 3 protocols cover 95% of use cases or only 60%. May need to expand sooner than anticipated.

**Technical uncertainty:**
- CSP solver performance with real-world constraint complexity unknown. 10k iteration limit may be too conservative (could solve more) or too aggressive (still causes freezes). Needs benchmarking during Phase 5 planning.
- localStorage quota of 5-10MB adequate for ~1000 lots claim is rough estimate. Needs validation with actual JSON size testing during Phase 4.
- Tabulator performance with 100+ rows untested. May need virtualization sooner than expected if rows contain complex formatting (conflict indicators, tooltips).

**Domain knowledge gaps:**
- IATF protocol variations beyond standard D0-D7-D9, D0-D8-D10, D0-D9-D11 not fully researched. May encounter requests for custom timing patterns that don't fit interval model.
- Cost comparison requirements (from Excel planner) not detailed. Unclear what cost inputs needed (medication prices? labor? per-dose vs per-lot?).
- Brazil-specific requirements (Sunday constraints, regional date formats) inferred but not validated with Brazilian producers.

**How to handle during execution:**
- **Feature gaps:** Implement MVP with 3 protocols and 4 rounds, add telemetry/feedback mechanism to track requests for additional protocols or rounds.
- **Technical gaps:** Include performance benchmarks in Phase 2 (table rendering) and Phase 5 (conflict resolution) acceptance criteria. Fail fast if performance targets not met.
- **Domain gaps:** Engage with Brazilian beef producers during Phase 1-2 for protocol validation. If access unavailable, defer custom protocols to v2+ and stick with standard 3 documented by Beef Reproduction Task Force.

## Sources

### Primary (HIGH confidence)
- **STACK.md:** Preact docs, date-fns v4.0 release notes, jsPDF GitHub, SheetJS official docs, Vite vs Webpack 2025 comparisons
- **FEATURES.md:** Iowa Beef Center Estrus Synchronization Planner (Excel tool), Beef Reproduction Task Force protocols, SD State Extension guides
- **ARCHITECTURE.md:** Zustand persist middleware docs, domain-driven design patterns, CSP solver libraries (kiwi.js, csp.js)
- **PITFALLS.md:** JavaScript Date calculation pitfalls (2026 analysis), MDN localStorage quota docs, NP-hard scheduling complexity research

### Secondary (MEDIUM confidence)
- **STACK.md:** NPM trends for framework popularity, state management comparisons 2026, table library comparisons
- **FEATURES.md:** Livestock management software comparisons (CattleMax, Farmbrite), breeding season management guides
- **ARCHITECTURE.md:** State management patterns 2026, conflict detection algorithms, observer pattern implementations
- **PITFALLS.md:** localStorage error handling guides, Excel date export issues, table virtualization performance

### Tertiary (LOW confidence)
- **FEATURES.md:** Brazil-specific Sunday constraint (inferred from cultural context, not explicitly documented in IATF sources)
- **PITFALLS.md:** 1000-lot localStorage capacity estimate (rough calculation, not empirically tested)

---
*Research completed: 2026-02-12*
*Ready for roadmap: yes*
