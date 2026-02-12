# Pitfalls Research

**Domain:** Date calculation and scheduling web application
**Researched:** 2026-02-12
**Confidence:** MEDIUM

## Critical Pitfalls

### Pitfall 1: Month Off-By-One Errors in Date Construction

**What goes wrong:**
JavaScript's Date constructor uses zero-indexed months (0=January, 11=December), but days are one-indexed (1-31). This causes calculations like `new Date(2026, 2, 1)` to create March 1st instead of February 1st, breaking protocol date calculations entirely.

**Why it happens:**
Developers instinctively think "month 2 = February" and miss that JavaScript counts from zero. When calculating D0 + protocol days, this shifts every subsequent date by one month.

**How to avoid:**
- Always use `const MONTHS = { JAN: 0, FEB: 1, ... }` constants
- Prefer date libraries (date-fns, Luxon) that use human-readable month numbers
- Add unit tests for month boundary transitions: Jan→Feb, Feb→Mar (leap years), Dec→Jan
- Never use raw month numbers in Date constructors

**Warning signs:**
- Dates appear one month later than expected
- Protocol calculations work in some months but fail in others
- February dates show as March

**Phase to address:**
Phase 1 (Core Date Engine) - Must establish date creation patterns before any calculation logic.

---

### Pitfall 2: Timezone Interpretation Destroying Date-Only Values

**What goes wrong:**
JavaScript has no "date-only" type. `new Date(2026, 0, 1)` creates midnight local time, but `new Date("2026-01-01")` creates midnight UTC. When users in GMT-3 (Brazil) select D0 as Jan 1, 2026, it may be stored/displayed as Dec 31, 2025.

**Why it happens:**
Date strings without time are interpreted as UTC. `new Date(date.getFullYear(), 0, 1)` in GMT+2 returns Dec 31, 2025 23:00 because it's creating Jan 1 local time, then displaying in local timezone context.

**How to avoid:**
- **Never use ISO date strings for date-only values** (always include time or use library constructors)
- Use date-fns `startOfDay()` or Luxon's `DateTime.local()` for timezone-safe date creation
- Store dates as ISO strings with explicit time (`2026-01-01T00:00:00`) or as YYYY-MM-DD format with custom parser
- For localStorage persistence, store as `{ year: 2026, month: 1, day: 1 }` object, not Date.toString()
- Test in GMT+2 and GMT-3 timezones (common issue zones)

**Warning signs:**
- Dates are off by one day for some users but not others
- Dates look correct in local development but wrong in production
- Export to Excel shows Dec 31 instead of Jan 1

**Phase to address:**
Phase 1 (Core Date Engine) - Critical foundation. Must be solved before any user-facing date input.

---

### Pitfall 3: Month Overflow Creating Bizarre Dates

**What goes wrong:**
Adding 30 days to Jan 31 using `setDate(date.getDate() + 30)` doesn't produce Mar 2—it may produce Mar 3 or Feb 28 depending on implementation. Setting month to 12 (13th month) creates February of next year instead of error.

**Why it happens:**
JavaScript Date is mutable and "helpful"—it auto-corrects invalid dates. `new Date(2026, 13, 1)` becomes `new Date(2027, 1, 1)` (Feb 1, 2027). Adding days across month boundaries requires knowing how many days are in each month, which changes with leap years.

**How to avoid:**
- **Never use mutable Date arithmetic** (setDate, setMonth, etc.)
- Use date-fns `addDays()`, `addMonths()` which handle boundaries correctly
- For protocol intervals (D0 + 22 days), use `addDays(startDate, 22)` not `new Date(start.getTime() + 22 * 86400000)`
- Validate expected ranges: if adding 22 days to Jan 10 produces date in April, something is wrong
- Test cases: Jan 31 + 1 month, Feb 28 (leap year) + 1 day, Dec 31 + 1 day

**Warning signs:**
- Protocol dates skip months (D0 in Jan, D22 in April)
- Year transitions fail (Dec D0 → January round dates are wrong)
- Leap year calculations produce Feb 29 in non-leap years

**Phase to address:**
Phase 1 (Core Date Engine) - Must be resolved before implementing interval calculations (D0 + 22, D0 + 44, etc.)

---

### Pitfall 4: Brute-Force Conflict Resolution Becomes Exponential

**What goes wrong:**
Naive conflict resolution tries all combinations: 5 lots × 4 rounds = 20 events. If conflicts exist, trying every permutation = 20! = 2.4 quintillion combinations. Browser freezes, tab crashes, users lose data.

**Why it happens:**
Job-shop scheduling is NP-hard. "Try all combinations until conflict-free" seems simple but scales catastrophically. With constraints (D0 + protocol intervals + 22-day minimums), the search space explodes.

**How to avoid:**
- **Do not implement full combinatorial search**
- Use greedy heuristic: sort lots by flexibility (fewest valid D0 options first), assign conflicts last
- Incremental resolution: when lot A conflicts with lot B on day X, try shifting A by ±1 day, then ±2, etc. (max radius: 7 days)
- Set iteration limit (e.g., 10,000 attempts) and fail gracefully with "cannot auto-resolve" message
- Provide manual conflict resolution UI as primary path (automatic is nice-to-have)
- Consider constraint propagation: if lot A uses day X, mark X as unavailable for conflicting lots

**Warning signs:**
- "Resolve conflicts" button hangs for >2 seconds with 3+ lots
- Browser tab uses 100% CPU
- Adding 6th lot causes freeze (not just slowdown)
- Memory usage climbs continuously during resolution

**Phase to address:**
Phase 3 (Conflict Resolution) - Defer to phase 3, implement greedy algorithm not brute-force. Phase 2 should include conflict *detection* only.

---

### Pitfall 5: localStorage Quota Exceeded Kills All Data

**What goes wrong:**
User adds 5th lot, clicks "Save", gets `QuotaExceededError`, and localStorage.setItem() fails silently or throws. Previous data may be lost if save was partially written. User refreshes page and all work is gone.

**Why it happens:**
localStorage limit is 5-10MB (browser-dependent). Storing full history of edits, undo states, or bloated JSON (pretty-printed with whitespace) fills quota. Error handling is inconsistent across browsers (Chrome throws DOMException code 22, Firefox throws NS_ERROR_DOM_QUOTA_REACHED, Safari fails silently in private mode).

**How to avoid:**
- **Always wrap localStorage in try-catch:**
  ```javascript
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    if (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014) {
      // Show user-friendly message
      // Fall back to in-memory only
    }
  }
  ```
- Compress JSON with `JSON.stringify` without whitespace
- Store only current state, not full edit history
- Estimate size: `JSON.stringify(data).length` and warn at 4MB (80% of 5MB limit)
- Implement cleanup: delete old data if quota is low
- Gracefully degrade: "Your data is not saved—export to Excel now"
- **Never make localStorage save mandatory for app to function**

**Warning signs:**
- Error in console: "QuotaExceededError"
- App works in normal mode but fails in private/incognito
- Data disappears after refresh
- Save button appears to work but data isn't persisted

**Phase to address:**
Phase 4 (Persistence) - Implement defensive try-catch and quota monitoring before releasing persistence feature.

---

### Pitfall 6: Print CSS Breaks PDF Layout

**What goes wrong:**
User exports to PDF via browser print (window.print()). Table is cut off mid-row, headers missing on page 2, fonts replaced with fallbacks, conflict highlights disappear, and page numbers are missing.

**Why it happens:**
Print CSS (@media print) isn't automatically applied—it requires explicit rules. Scrollable tables capture only visible portion. Print preview snapshots DOM before assets load. Page breaks occur mid-table-row by default.

**How to avoid:**
- Create `@media print` styles that:
  - Remove navigation/buttons (`display: none`)
  - Add `page-break-inside: avoid` to table rows
  - Use `thead { display: table-header-group }` to repeat headers
  - Expand collapsed content (no "click to see more" in print)
  - Use print-safe fonts (fallback to system fonts, not web fonts that may not load)
- Test print preview in Chrome, Firefox, Safari (results differ)
- For complex layouts, generate PDF server-side (headless Chrome) instead of client-side print
- Include print instructions: "Use Landscape orientation, fit to page width"
- Add visible page numbers and date in footer using CSS `@page` rules

**Warning signs:**
- Print preview shows blank pages
- Tables cut off at page boundaries
- Fonts look wrong in PDF
- Color-coded conflicts appear as identical gray in print

**Phase to address:**
Phase 5 (Export) - Print CSS must be tested during export implementation, not added as afterthought.

---

### Pitfall 7: Excel Export Shows Dates as Numbers or Text

**What goes wrong:**
User exports to Excel. Date column shows `44927` (Excel serial number) or `"2026-01-01"` (text string). Sorting breaks. Date formulas don't work. User manually fixes 60+ cells.

**Why it happens:**
Excel stores dates as serial numbers (days since Jan 1, 1900). CSV export writes dates as strings, which Excel interprets based on regional settings (MM/DD/YYYY in US, DD/MM/YYYY in Brazil). ISO format (YYYY-MM-DD) becomes text, not date.

**How to avoid:**
- Use actual Excel format (XLSX) not CSV for date columns
- Use library like `xlsx` or `exceljs` that writes proper Excel date cells with formatting
- If CSV is required:
  - Format dates as `MM/DD/YYYY` (Excel's default in most regions)
  - Add Excel formula prefix `=""&DATE(2026,1,1)&""` for programmatic dates
  - Include instruction row: "Dates are in MM/DD/YYYY format"
- Test export in Excel with different regional settings (US, Brazil, Europe)
- For XLSX: set column data type to `Date` and apply date number format

**Warning signs:**
- Excel shows 44927 instead of Jan 1, 2026
- Dates appear as text with green triangle error
- Sorting dates produces wrong order (text sort: "2026-12-01" before "2026-02-01")
- User in Brazil sees reversed month/day

**Phase to address:**
Phase 5 (Export) - Excel export requires XLSX library, not naive CSV generation.

---

### Pitfall 8: Table Rendering Kills Performance at 100+ Cells

**What goes wrong:**
User adds 5 lots with 4 rounds each (60 cells). Table becomes sluggish. Adding 6th lot freezes for 3 seconds on each input change. Typing in form fields lags.

**Why it happens:**
Re-rendering entire table on every state change causes React/Vue to diff and update 60+ DOM nodes. Conflict detection runs on every keystroke. Date formatting (toLocaleDateString) called 60 times per render.

**How to avoid:**
- Use virtualization for tables >50 rows (react-window, @tanstack/react-virtual)
- Memoize expensive calculations (conflict detection, date formatting)
- Debounce conflict detection: don't recalculate on every keystroke, wait 300ms after user stops typing
- Use `React.memo()` or `shouldComponentUpdate()` to prevent unnecessary re-renders
- Format dates once and cache: `const formatted = useMemo(() => formatDate(date), [date])`
- Limit initial render to 3 lots, show "Load more" button
- Profile with React DevTools or Vue DevTools to identify bottlenecks

**Warning signs:**
- Input fields lag behind typing
- Scrolling is janky (not 60fps)
- Adding 5th lot noticeably slower than 3rd
- Browser DevTools shows >16ms render time (not 60fps)

**Phase to address:**
Phase 2 (Table Visualization) - Performance optimization must be built-in from start, not retrofitted.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Using native Date instead of library | No dependencies, smaller bundle | Month off-by-one bugs, timezone issues, month overflow errors | Never—date-fns adds 10KB, prevents 90% of date bugs |
| Storing dates as ISO strings in localStorage | Simple serialization | Timezone interpretation issues on reload, can't perform date math without parsing | Never—store as `{ year, month, day }` object |
| CSV export instead of XLSX | Simpler implementation, no library | Date formatting breaks in Excel, regional setting issues | Only if users are tech-savvy and understand CSV limitations |
| Brute-force conflict resolution | Easy to understand algorithm | Exponential complexity, browser freeze, unusable with 5+ lots | Only for MVP with max 2 lots hardcoded limit |
| No localStorage quota check | Works for most users | Catastrophic data loss when quota exceeded | Never—wrapping in try-catch costs 5 lines of code |
| Table renders all rows | Simple implementation | Performance degrades with >50 cells | Only for MVP with max 3 lots hardcoded limit |
| Manual date arithmetic (getDate + 22) | No library needed | Month overflow bugs, leap year issues | Never—addDays() is the correct approach |
| window.print() without @media print | Quick PDF export | Broken layouts, missing headers, unusable output | Never—print CSS is required for usable PDFs |

---

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Browser print API | Assuming print CSS applies automatically | Define explicit `@media print` rules, test in multiple browsers |
| localStorage | Not checking quota or handling errors | Wrap all writes in try-catch, monitor quota usage, gracefully degrade |
| Excel (XLSX) | Generating CSV and calling it "Excel export" | Use xlsx/exceljs library to create proper .xlsx with date formatting |
| Date parsing | Using `new Date(userInput)` which varies by browser | Use date library parse() with explicit format string |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Re-rendering entire table on state change | Input lag, sluggish scrolling | Use memoization, virtualization, debouncing | 50+ table cells (5 lots × 10 dates) |
| Brute-force conflict resolution (try all combinations) | Browser freeze, tab crash | Use greedy heuristic, set iteration limit (10k max) | 4+ lots with conflicts |
| Running conflict detection on every keystroke | Input lag, high CPU usage | Debounce to 300ms after user stops typing | 3+ lots with complex constraints |
| Calling toLocaleDateString() 60 times per render | Slow renders, janky UI | Cache formatted dates with useMemo() | 30+ date cells rendered |
| Storing full edit history in localStorage | Quota exceeded after 10 edits | Store only current state, implement cleanup | 20+ state snapshots |

---

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Storing sensitive farm/lot data in localStorage | Data visible in browser DevTools, persists after logout | Warn users that data is stored locally, add "Clear all data" button, consider encryption for sensitive fields |
| No data export before clearing localStorage | User loses all work if they clear browser data | Always offer "Export to Excel" before any destructive action, auto-export on close if unsaved changes |
| Trusting client-side date validation | User can manipulate DOM to enter invalid dates | Add server-side validation if backend is added later, use defensive programming (reject invalid dates in calculations) |

---

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Generic error: "Date calculation failed" | User doesn't know what's wrong or how to fix | Specific message: "Round 2 conflicts with Round 1—D0 must be at least 22 days after Round 1 D0" |
| No indication of why auto-resolve failed | User tries repeatedly, doesn't understand limitation | Show reason: "Cannot auto-resolve: Lots A and B require same day. Manually adjust one lot's D0 by ±3 days" |
| Conflict resolution changes user's D0 without asking | User's careful planning is overwritten | Show preview: "Auto-resolve will change Lot B D0 from Jan 15 → Jan 18. Accept?" |
| Export button with no feedback | User clicks, nothing happens, clicks 10 more times | Show loading spinner, then success message: "Exported to Downloads/breeding-schedule.xlsx" |
| localStorage quota exceeded crashes silently | User loses all work, no explanation | Clear message: "Storage full. Export to Excel now to save your work. Some features disabled." |
| Dates appear in ISO format (2026-01-01) | Technical users okay, but not user-friendly for technicians | Use localized format (01/01/2026 in Brazil) with option to toggle formats |
| No visual indication of conflicts in table | User must read all dates manually to spot issues | Color-code conflicts (red background), add icon, show tooltip with explanation |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Date calculations:** Often missing leap year handling—verify Feb 29, 2028 + 22 days works correctly
- [ ] **Conflict detection:** Often missing round-to-round conflicts—verify same lot's rounds don't overlap (D0 + intervals + 22 days between rounds)
- [ ] **Timezone handling:** Often missing timezone normalization—verify dates are same for users in GMT-3, GMT+0, GMT+2
- [ ] **Export to Excel:** Often missing proper date formatting—open exported file in Excel and verify dates aren't text or serial numbers
- [ ] **localStorage persistence:** Often missing quota exceeded handling—fill localStorage to 95% and verify app doesn't crash
- [ ] **Print layout:** Often missing page break control—print 10-lot schedule and verify rows aren't split across pages
- [ ] **Conflict resolution:** Often missing iteration limit—give it impossible constraints and verify it doesn't freeze
- [ ] **Error messages:** Often missing actionable guidance—show error to non-developer and ask "what would you do next?"
- [ ] **Month boundaries:** Often missing December→January transition—verify D0 = Dec 15 + 22 days = Jan 6 (next year)
- [ ] **Private browsing:** Often missing localStorage unavailability handling—test in incognito mode where localStorage may be disabled

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Month off-by-one errors in production | MEDIUM | Add +1 to all month values in database migration, deploy hotfix, notify users of date changes |
| Timezone issues causing date shifts | HIGH | Cannot auto-fix (user intent unclear). Show banner: "Dates may be incorrect. Please review and re-enter." Add migration to future-proof |
| localStorage quota exceeded | LOW | Clear old data, compress JSON, show "Export to Excel" prompt, fall back to session-only storage |
| Brute-force freeze in conflict resolution | LOW | Add timeout (2 seconds), kill resolution, show message: "Auto-resolve unavailable. Manually adjust dates." |
| Excel export produces text dates | LOW | Re-export using XLSX library, document workaround: "In Excel, select column → Data → Text to Columns → Date" |
| Table performance degradation | MEDIUM | Add virtualization library, implement pagination, show "Loading..." for large datasets |
| Print layout broken | LOW | Add print CSS, test in multiple browsers, document workaround: "Export to Excel, then print from Excel" |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Month off-by-one errors | Phase 1 (Core Date Engine) | Unit test: `addMonths(new Date(2026, 0, 1), 1)` returns Feb 1 not Mar 1 |
| Timezone interpretation issues | Phase 1 (Core Date Engine) | Test in GMT-3 and GMT+2, verify Jan 1 displays as Jan 1 not Dec 31 |
| Month overflow creating wrong dates | Phase 1 (Core Date Engine) | Test: Jan 31 + 1 month = Feb 28 (or Feb 29 leap year), not Mar 3 |
| Brute-force conflict resolution exponential | Phase 3 (Conflict Resolution) | Add 5 lots with conflicts, verify resolution completes in <2 seconds |
| localStorage quota exceeded | Phase 4 (Persistence) | Fill localStorage to 95%, add data, verify graceful error handling |
| Print CSS breaks PDF layout | Phase 5 (Export) | Export 10-lot schedule, verify no cut-off rows, headers on all pages |
| Excel export shows dates as text | Phase 5 (Export) | Open exported file in Excel, verify dates are sortable and formatted |
| Table rendering performance degradation | Phase 2 (Table Visualization) | Add 100 cells, verify input lag <50ms, scrolling at 60fps |

---

## Sources

### Date Calculation & JavaScript Date API
- [How wrong can a JavaScript Date calculation go?](https://philna.sh/blog/2026/01/11/javascript-date-calculation/) - Recent 2026 analysis of Date pitfalls
- [The Many Quirks of Javascript Dates](https://fjolt.com/article/javascript-date-is-weird) - Month off-by-one, timezone issues
- [The End of JavaScript's Broken Date: Why Temporal Changes Everything](https://medium.com/@jagan_reddy/javascripts-date-is-broken-heres-why-temporal-is-the-future-a9f29cb9f89e) - Mutable date objects, parsing inconsistencies
- [JavaScript Date Tutorial: Get the Timezone Right!](https://www.fullstackfoundations.com/blog/javascript-dates) - Timezone-aware development
- [ES2026 Solves JavaScript Headaches With Dates, Math and Modules](https://thenewstack.io/es2026-solves-javascript-headaches-with-dates-math-and-modules/) - Temporal API as solution
- [JavaScript: Easiest Way to Add X Months to a Date](https://www.xjavascript.com/blog/javascript-function-to-add-x-months-to-a-date/) - Month arithmetic with year rollover

### Conflict Resolution & Scheduling Algorithms
- [Old school AI isn't dead: How we achieved a 12× speedup on an NP hard problem](https://www.assembled.com/blog/np-hard-scheduling-optimization) - Workforce scheduling complexity
- [Research on Cloud Task Scheduling Algorithm with Conflict Constraints](https://www.mdpi.com/2076-3417/13/13/7505) - Antiaffinity constraints, resource contention
- [Advanced Conflict Detection Algorithms For Mobile Scheduling Resources](https://www.myshyft.com/blog/conflict-detection-algorithms/) - Multi-dimensional analysis, real-time detection
- [Combinatorial Optimization Problem - Overview](https://www.sciencedirect.com/topics/computer-science/combinatorial-optimization-problem) - NP-hard complexity

### localStorage & Storage Management
- [Storage quotas and eviction criteria - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria) - 5-10MB limits
- [How to fix 'Failed to execute setItem on Storage'](https://trackjs.com/javascript-errors/failed-to-execute-setitem-on-storage/) - QuotaExceededError handling
- [Handling localStorage errors](https://mmazzarolo.com/blog/2022-06-25-local-storage-status/) - Cross-browser error detection
- [Always catch LocalStorage security and quota exceeded errors](http://crocodillon.com/blog/always-catch-localstorage-security-and-quota-exceeded-errors) - Try-catch approach
- [Understanding and Resolving LocalStorage Quota Exceeded Errors](https://medium.com/@zahidbashirkhan/understanding-and-resolving-localstorage-quota-exceeded-errors-5ce72b1d577a) - Data cleanup strategies

### PDF/Print Layout
- [Integrating PDF generation into Node.js backends: tips & gotchas](https://joyfill.io/blog/integrating-pdf-generation-into-node-js-backends-tips-gotchas) - Asset loading, performance issues
- [JavaScript window.print(): A Practical Guide](https://thelinuxcode.com/javascript-windowprint-a-practical-guide-to-printing-web-pages-without-shipping-print-bugs/) - Print CSS, scrollable containers
- [PDF Gotchas with Headless Chrome](https://nathanfriend.com/2019/04/15/pdf-gotchas-with-headless-chrome.html) - Rendering differences, version pinning

### Excel Export
- [Incorrect Date format after Export to Excel](https://community.qlik.com/t5/App-Development/Incorrect-Date-format-after-Export-to-Excel-becomes-negative/td-p/2436222) - Regional settings conflicts
- [How to open a CSV file in Excel to fix date formatting issues](https://support.insight.ly/en-US/Knowledge/article/1197/How_to_open_a_CSV_file_in_Excel_to_fix_date_and_other_formatting_issues/) - CSV import problems
- [6 Ways to Fix Dates Formatted as Text in Excel](https://www.myonlinetraininghub.com/6-ways-to-fix-dates-formatted-as-text-in-excel) - Text vs date values
- [Fixing date format or sort issues in Excel](https://www.auditexcel.co.za/blog/fixing-date-format-or-sort-issues-in-excel/) - Serial number system

### Table Performance
- [5 Best React Data Grid Libraries for 2026](https://www.syncfusion.com/blogs/post/top-react-data-grid-libraries) - Virtual scrolling solutions
- [How To Render Large Datasets In React without Killing Performance](https://www.syncfusion.com/blogs/post/render-large-datasets-in-react) - Virtualization, windowing
- [Efficiently Rendering Large Data Tables in Angular with CDK Virtual Scrolling](https://medium.com/@kacarik.alen/efficiently-rendering-large-data-tables-in-angular-harnessing-the-power-of-cdk-virtual-scrolling-db484f7f6cca) - Row virtualization patterns
- [Optimize Large Data Grids with Virtual Scrolling](https://www.componentsource.com/news/2025/12/17/optimize-large-data-grids-virtual-scrolling) - DOM reuse, 60fps maintenance

### UX & Error Messages
- [Error-Message Guidelines](https://www.nngroup.com/articles/error-message-guidelines/) - Nielsen Norman Group best practices
- [Writing Helpful Error Messages](https://developers.google.com/tech-writing/error-messages) - Google developer guidelines
- [Write actionable error messages](https://developers.google.com/workspace/chat/write-error-messages) - Actionable solutions, plain language
- [User experience guidelines for errors](https://learn.microsoft.com/en-us/dynamics365/business-central/dev-itpro/developer/devenv-error-handling-guidelines) - Technical vs non-technical users

### Date Libraries Comparison
- [date-fns vs Luxon detailed comparison](https://www.slant.co/versus/20523/29531/~date-fns_vs_luxon) - 2026 comparison
- [Moment.js Alternatives for Date Handling in JavaScript](https://betterstack.com/community/guides/scaling-nodejs/momentjs-alternatives/) - Modern alternatives
- [Luxon Vs Date Fns: Which One's Better For Your Project?](https://www.dhiwise.com/post/luxon-vs-date-fns-whats-the-best-for-managing-dates) - Bundle size, API comparison

---
*Pitfalls research for: IATF Breeding Season Date Calculator (Calculo Estacao)*
*Researched: 2026-02-12*
