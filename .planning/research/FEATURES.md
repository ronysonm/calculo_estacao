# Feature Landscape

**Domain:** IATF Breeding Season Date Calculator for Beef Cattle
**Researched:** 2026-02-12
**Confidence:** MEDIUM

## Table Stakes

Features users expect. Missing = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Multiple protocol support | Standard protocols (D0-D7-D9, D0-D8-D10, D0-D9-D11) are industry standard. Excel planner supports multiple protocols with comparison | LOW | Built-in protocols are well-documented by Beef Reproduction Task Force |
| Date calculation with calendar output | Core function - eliminates manual calculation errors. Excel planner generates calendars showing specific dates and times | LOW | Must prevent timing errors in injections, MGA feeding, CIDR insertions |
| Multiple lot/group management | Producers manage different categories (primiparous, secundiparous, multiparous, heifers). Multi-group Excel planner handles up to 12 groups | MEDIUM | Categories have different reproductive characteristics, need separation |
| Cost analysis/comparison | Excel planner provides cost comparison of protocols and cost per AI pregnancy. Essential for economic decision-making | MEDIUM | Helps justify protocol selection, compare input costs |
| Printable calendar/reports | Excel planner generates barn sheets and monthly calendars. Essential for field use where digital access limited | LOW | PDF export standard, needs clear date/time visibility |
| Supply list generation | Multi-group Excel planner generates detailed supply lists. Prevents under-ordering medications/equipment | MEDIUM | Aggregates across groups, accounts for protocol-specific needs |
| Protocol selection guidance | Excel planner steps users through protocol selection based on cattle type, heat detection, breeding date/time | MEDIUM | Reduces decision paralysis, ensures appropriate protocol choice |

## Differentiators

Features that set product apart. Not expected, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Conflict detection (Sundays) | Excel planner doesn't mention this. Weekends problematic for labor scheduling, vet availability | MEDIUM | Sunday work cultural/labor issue in Brazil, vet availability constraint |
| Intelligent conflict resolution | Auto-stagger and interval adjustment not in Excel planner. Reduces manual replanning | HIGH | Excel planner requires manual protocol restart, this automates resolution |
| Lot overlap detection | Excel planner shows all groups on one calendar but doesn't flag overlaps. Prevents labor bottlenecks | MEDIUM | Critical when same team handles multiple lots, prevents double-booking |
| Custom protocol builder | Excel planner has fixed protocols. Producers/vets may want custom timing variations | MEDIUM | Advanced feature, enables experimentation while maintaining structure |
| Local storage/offline-first | Web Excel planners require download, local Excel works offline. Connectivity unreliable on farms | LOW | Web app advantage: no Excel dependency, works on any device |
| Multiple rounds (A1-A4) auto-scheduling | Excel planner handles one breeding season. Multiple rounds require separate planners | MEDIUM | Enables year-long planning, seasonal operations common in Brazil |
| iCalendar export (.ics) | Excel planner app has this. Integration with Google Calendar, Outlook increases adoption | LOW | Modern expectation, reduces manual calendar entry |
| Mobile-responsive interface | Excel planner has smartphone app. Producers work in field, need mobile access | MEDIUM | Web app advantage over desktop Excel, eliminates app download |
| Protocol comparison view | Excel planner compares up to 3 protocols side-by-side. Helps decision-making | LOW | Already validated by Excel planner, users value this |
| Single-season focus | Complexity reduction vs full herd management. Aligns with project scope | LOW | Anti-complexity: not trying to replace CattleMax/Farmbrite |

## Anti-Features

Features to explicitly NOT build.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Full herd management system | Scope creep. CattleMax, Farmbrite, Herdwatch already comprehensive. Excel planner stays focused on synchronization only | Stay focused on date calculation and conflict resolution for breeding season planning |
| Individual animal tracking | Not needed for lot-based IATF. Adds database complexity, authentication, backup requirements | Work at lot level (Primiparas, Secundiparas, etc.), not individual animal IDs |
| Multi-user collaboration | Adds authentication, permissions, real-time sync complexity. Excel planner is single-user | Local storage, one season at a time. Export/share via PDF/Excel if collaboration needed |
| Cloud sync/backup | Feature expectation creep. Requires backend, accounts, data privacy compliance | Local storage only. User handles backups via export |
| Inventory management | Excel planner generates supply list but doesn't track usage. Beyond core value proposition | Provide supply list output, let users manage inventory elsewhere |
| Financial tracking beyond protocol costs | Full P&L, income tracking is herd management software territory | Cost comparison for protocol selection only, not enterprise financials |
| Veterinary EMR features | Health records, treatments, diagnoses are vet clinic software. Out of scope | Focus on breeding protocol timing, not health records |
| Breeding outcome tracking | Pregnancy rates, calving success, genetic performance requires long-term data and individual animal tracking | Provide planning tool, not outcome analytics |
| Multi-farm/enterprise management | Adds organizational complexity. Excel planner is per-operation | One farm, one season at a time |
| Real-time notifications | Requires push infrastructure, app downloads, permissions. Email reminders add complexity | Printable calendars and iCalendar export sufficient for reminders |

## Feature Dependencies

```
Protocol Selection
    └──requires──> Date Calculation Engine
                       └──requires──> Calendar Generation
                                          └──enhances──> Conflict Detection
                                                             └──requires──> Intelligent Resolution

Multiple Lots
    └──requires──> Date Calculation per Lot
                       └──enhances──> Lot Overlap Detection
                                          └──requires──> Intelligent Resolution

Multiple Rounds
    └──requires──> Date Calculation per Round
                       └──enhances──> Round Spacing Logic

Export (PDF/Excel)
    └──requires──> Calendar Generation
                       └──requires──> Supply List Generation

Custom Protocols
    └──requires──> Protocol Definition Interface
                       └──requires──> Date Calculation Engine (protocol-agnostic)

Conflict Detection
    ──conflicts──> Manual Date Entry (if dates auto-calculated, conflict detection must run)
```

### Dependency Notes

- **Protocol Selection requires Date Calculation Engine:** Without calculating dates, protocol selection is just documentation
- **Date Calculation requires Calendar Generation:** Dates must be visualized for usability, barn sheets are essential output
- **Calendar Generation enhances Conflict Detection:** Once calendar exists, overlaps/conflicts become detectable
- **Conflict Detection requires Intelligent Resolution:** Detecting without offering solutions frustrates users, forces Excel planner's manual restart
- **Multiple Lots enhances Lot Overlap Detection:** Single lot = no overlap possible
- **Export requires Calendar Generation:** Can't export what hasn't been generated
- **Custom Protocols require Protocol-agnostic engine:** Hardcoded protocols prevent custom protocol feature

## MVP Recommendation

### Launch With (v1)

Minimum viable product - what's needed to validate the concept and replace current Excel workflow.

- [x] **Protocol selection (3 built-in protocols)** - Table stakes, differentiates from pure calendar tools
- [x] **Multiple lot management (5 standard categories)** - Expected by beef producers using lot-based systems
- [x] **Date calculation with calendar view** - Core value proposition, eliminates manual calculation errors
- [x] **Conflict detection (Sundays + lot overlaps)** - Key differentiator vs Excel planner
- [x] **Basic conflict resolution (manual D0 adjustment)** - Minimum viable resolution, user-controlled
- [x] **PDF export** - Table stakes for barn sheets, field use
- [x] **Local storage** - Offline-first expectation for farm tools
- [x] **Multiple rounds (A1-A4 default)** - Standard for seasonal operations

**Rationale:** These features replicate Excel planner table stakes while adding conflict detection/resolution differentiators. Sufficient to validate "better than Excel" value proposition.

### Add After Validation (v1.x)

Features to add once core is working and users validate the approach.

- [ ] **Intelligent conflict resolution (auto-stagger)** - Enhances core differentiator, but complex. Validate manual resolution first
- [ ] **Excel export** - Excel planner generates Excel, expect parity. Lower priority than PDF
- [ ] **iCalendar export (.ics)** - Modern convenience, Excel planner app has this. Add when calendar integration requested
- [ ] **Custom protocol builder** - Advanced feature for power users/vets. Validate built-in protocols sufficient first
- [ ] **Supply list generation** - Excel planner has this, expect parity. Lower priority than conflict features
- [ ] **Protocol cost comparison** - Excel planner table stakes, but lower priority than date conflicts

**Trigger for adding:** User feedback requesting specific feature, evidence that MVP limitations block adoption.

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] **Additional protocols beyond 3** - Wait for user requests for specific protocols before expanding
- [ ] **Multi-season planning** - Scope says "one season at a time," validate single-season sufficient
- [ ] **Advanced conflict resolution (interval adjustment)** - Complex optimization, validate auto-stagger sufficient first
- [ ] **Mobile app (native)** - Web-responsive may be sufficient, native app adds distribution complexity
- [ ] **Sharing/collaboration features** - Anti-feature currently, only add if strong demand emerges
- [ ] **Integration with herd management systems** - Scope creep risk, only if clear integration partner emerges

**Why defer:** Optimize for learning and iteration speed. These features add complexity without validating core value proposition.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Date calculation engine | HIGH | MEDIUM | P1 |
| Calendar generation | HIGH | MEDIUM | P1 |
| Multiple lots (5 categories) | HIGH | LOW | P1 |
| Built-in protocols (3) | HIGH | LOW | P1 |
| Conflict detection (Sundays) | HIGH | LOW | P1 |
| Conflict detection (lot overlap) | HIGH | MEDIUM | P1 |
| Manual conflict resolution | MEDIUM | LOW | P1 |
| PDF export | HIGH | LOW | P1 |
| Local storage | HIGH | LOW | P1 |
| Multiple rounds (A1-A4) | MEDIUM | LOW | P1 |
| Intelligent resolution (auto-stagger) | HIGH | HIGH | P2 |
| Excel export | MEDIUM | MEDIUM | P2 |
| iCalendar export | MEDIUM | LOW | P2 |
| Supply list generation | MEDIUM | MEDIUM | P2 |
| Protocol cost comparison | MEDIUM | LOW | P2 |
| Custom protocol builder | MEDIUM | HIGH | P2 |
| Advanced conflict resolution (interval) | LOW | HIGH | P3 |
| Additional protocols (>3) | LOW | MEDIUM | P3 |
| Multi-season planning | LOW | MEDIUM | P3 |
| Native mobile app | LOW | HIGH | P3 |
| Sharing/collaboration | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for launch - core value proposition
- P2: Should have, add when possible - parity with Excel planner or key differentiators
- P3: Nice to have, future consideration - optimization and expansion features

## Competitor Feature Analysis

| Feature | Excel Estrus Synch Planner | Herd Management Systems (CattleMax, Farmbrite) | Our Approach |
|---------|---------------------------|-----------------------------------------------|--------------|
| Protocol selection | Yes - steps through selection | Not specialized for IATF | Yes - 3 built-in + custom builder (P2) |
| Multiple groups | Yes - up to 12 groups | Yes - unlimited animals/groups | Yes - 5 standard categories, unlimited custom |
| Date calculation | Yes - Excel formulas | Yes - breeding/calving dates | Yes - protocol-specific calculation |
| Calendar output | Yes - monthly calendar + barn sheets | Yes - general farm calendar | Yes - protocol-specific calendar |
| Cost comparison | Yes - up to 3 protocols | Yes - enterprise financials | Yes - protocol-level only (P2) |
| Supply list | Yes - multi-group aggregation | Inventory management | Yes - protocol-based (P2) |
| Conflict detection | No | No - general scheduling conflicts | **YES - Sundays + lot overlaps (DIFFERENTIATOR)** |
| Conflict resolution | Manual - restart protocol | N/A | **Manual (P1) → Auto-stagger (P2) → Interval (P3)** |
| Export formats | Excel, printable | PDF, Excel, CSV, multiple | PDF (P1), Excel (P2), iCalendar (P2) |
| Mobile access | Smartphone app | Full mobile apps | Web-responsive (P1), native app (P3) |
| Offline capability | Yes - downloadable Excel | Cloud-based, limited offline | **Yes - local storage (DIFFERENTIATOR)** |
| Individual animal tracking | No - lot level only | Yes - detailed per-animal records | **No - lot level (ANTI-FEATURE)** |
| Financial tracking | Protocol costs only | Full P&L, income/expense | Protocol costs only (ANTI-FEATURE) |
| Multi-user collaboration | No | Yes | **No (ANTI-FEATURE)** |
| Integration | iCalendar export | APIs, integrations with other farm tools | iCalendar export (P2) |
| Learning curve | Medium - Excel required | High - comprehensive training needed | **Low - focused tool (DIFFERENTIATOR)** |
| Pricing | Free | Subscription ($50-300/year) | Free (MVP validation phase) |

**Competitive positioning:**
- **vs Excel Planner:** Add conflict detection/resolution, eliminate Excel dependency, improve mobile experience
- **vs Herd Management Systems:** Narrower scope (breeding season only), simpler interface, offline-first, no subscription lock-in
- **Sweet spot:** Producers who find Excel planner limiting (conflicts, Excel dependency) but don't need/want full herd management system complexity

## Sources

### IATF Protocol Tools
- [Estrus Synchronization Planner (Original and Multigroup) - Iowa Beef Center](https://www.iowabeefcenter.org/estrussynch.html)
- [Resources | Beef Reproduction Task Force](https://beefrepro.org/resources/)
- [Estrus Synchronization Planner Makes AI Planning Easier - K-State Beef Tips](https://enewsletters.k-state.edu/beeftips/2020/02/28/estrus-synchronization-planner-makes-ai-planning-easier/)
- [Using the Estrus Synchronization Planner - SD State Extension](https://extension.sdstate.edu/using-estrus-synchronization-planner)
- [Free bovine estrus synchronization tool now available - MSU Extension](https://www.canr.msu.edu/news/free_bovine_estrus_synchronization_tool_now_available)

### Livestock Management Software
- [Livestock Software for Cattle - Farmbrite](https://www.farmbrite.com/livestock)
- [5 Best Cattle Breeding Software in 2025 - Ready to Ranch](https://readytoranch.com/cattle-breeding-software/)
- [Cattle Management Software - CattleMax](https://www.cattlemax.com/)
- [Herd Management Software - Herdwatch](https://herdwatch.com/)
- [16 Best Livestock Management Apps 2023 - AgriERP](https://agrierp.com/blog/best-livestock-management-apps/)
- [Livestock Management Software - AgTech Folio3](https://agtech.folio3.com/livestock-management-software/)

### Breeding Season Management
- [Implementing a Defined Breeding Season in Beef Cattle - NC State Extension](https://content.ces.ncsu.edu/implementing-a-defined-breeding-season-in-beef-cattle)
- [Beef Cattle Management: The Breeding Season - Riverbend Cattle](https://www.riverbendcattlecompany.com/blogs/news/beef-cattle-management-the-breeding-season)
- [Converting Beef Cow Herd to Controlled Breeding Season - UF IFAS Extension](https://edis.ifas.ufl.edu/publication/AN267)

### IATF Protocols
- [Programs for fixed-time artificial insemination in South American beef cattle - PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC9536051/)
- [Beef Cow Synchronization Protocols - Select Sires](https://selectsiresbeef.com/resources/estrus-synchronization/beef-cow-synch-protocols/)
- [2021 Beef Cow Synchronization Protocols - SD State Extension](https://extension.sdstate.edu/2021-beef-cow-synchronization-protocols)
- [Protocols | Beef Reproduction Task Force](https://beefrepro.org/protocols/)

### Cattle Categories and Management
- [Influence of category in resynchronization FTAI program - PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC4588023/)
- [Performance of Primiparous vs Multiparous Cows - ScienceDirect](https://www.sciencedirect.com/science/article/pii/S0022030206720999)
- [A first time for everything: Parity influence on transition dairy cows - PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC9709596/)

---
*Feature research for: IATF Breeding Season Date Calculator*
*Researched: 2026-02-12*
*Research confidence: MEDIUM (WebSearch primary source, validated across multiple agricultural extension sources)*
