# Roadmap: Calculo Estacao

## Overview

This roadmap delivers a client-side IATF breeding season calculator that replaces Excel planners with automatic date calculation, conflict detection, and intelligent resolution. Four phases build from foundation (date engine + domain model) through core UI (table visualization + lot management), conflict system (detection + auto-stagger resolution), to persistence and export (localStorage + PDF/Excel). The structure follows dependency order while compressing to quick depth for rapid MVP delivery.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation** - Date engine, domain model, and project setup
- [ ] **Phase 2: Core Application** - UI, calculation, lot management, and table visualization
- [ ] **Phase 3: Conflict System** - Detection, resolution algorithms, and auto-stagger
- [ ] **Phase 4: Persistence & Export** - localStorage and PDF/Excel generation

## Phase Details

### Phase 1: Foundation
**Goal**: Establish project infrastructure and bulletproof date calculation engine with domain model.
**Depends on**: Nothing (first phase)
**Requirements**: CALC-01, CALC-02, CALC-03, CALC-04, CALC-05
**Success Criteria** (what must be TRUE):
  1. Date engine correctly calculates manejo dates from D0 across all protocols without timezone or month-boundary errors
  2. System handles edge cases (leap years, Dec 31 + 1 day, month boundaries) correctly using date-fns
  3. Protocols (pre-defined and custom) are represented as immutable domain objects with validation
  4. Multiple rounds (A1-A4) calculate with configurable intervals (default 22 days) per lot
**Plans:** 3 plans

Plans:
- [ ] 01-01-PLAN.md — Project scaffolding (React + TypeScript + Vite + Tailwind + shadcn/ui + Vitest)
- [ ] 01-02-PLAN.md — Domain models (Protocol, Round, Lot) and pre-defined protocol constants
- [ ] 01-03-PLAN.md — Date calculation engine (TDD with edge case coverage)

### Phase 2: Core Application
**Goal**: Deliver working calculator UI with lot management and table visualization showing all calculated dates.
**Depends on**: Phase 1
**Requirements**: LOTE-01, LOTE-02, LOTE-03, LOTE-04, LOTE-05, VISU-01, VISU-02
**Success Criteria** (what must be TRUE):
  1. User can select D0 date and protocol for each lot and see all manejo dates calculated in table
  2. User can add, remove, and rename lotes (starts with 5 padrao lotes)
  3. Each lote can use different protocol (pre-defined or custom)
  4. Table displays caixas por rodada showing dates and day-of-week for each aplicacao
  5. UI remains responsive with 5+ lotes and 4 rodadas (60+ cells render without lag)
**Plans**: TBD

Plans:
- [ ] 02-01: TBD during phase planning

### Phase 3: Conflict System
**Goal**: Detect and resolve scheduling conflicts (Sundays and lot overlaps) automatically and manually.
**Depends on**: Phase 2
**Requirements**: CONF-01, CONF-02, CONF-03, CONF-04, CONF-05, CONF-06, CONF-07, CONF-08, CONF-09, CONF-10
**Success Criteria** (what must be TRUE):
  1. System detects and marks datas no domingo (red) and sobreposicao entre lotes (orange) visually in table
  2. User can manually reposition D0 of any lote to resolve conflicts
  3. Auto-Stagger automatically spaces D0s (1 dia entre lotes), allows locking specific lotes, shows preview before applying
  4. "Validar Tudo" button analyzes entire estacao and suggests best configuration using greedy algorithm
  5. Conflict resolution completes in under 2 seconds for 5 lotes, fails gracefully with message if impossible to resolve all
**Plans**: TBD

Plans:
- [ ] 03-01: TBD during phase planning

### Phase 4: Persistence & Export
**Goal**: Save work automatically and export schedules for field use (PDF/Excel).
**Depends on**: Phase 3
**Requirements**: PERS-01, PERS-02, EXPO-01, EXPO-02
**Success Criteria** (what must be TRUE):
  1. Estacao data saves automatically to localStorage and restores on reload
  2. App handles localStorage quota gracefully (warns at 80%, prompts export at 95%, degrades to session-only)
  3. User can export estacao completa to formatted PDF for barn printing
  4. User can export to Excel/CSV with dates correctly formatted (sortable, not text or serial numbers)
  5. Exported files are usable in field (PDF readable, Excel editable)
**Plans**: TBD

Plans:
- [ ] 04-01: TBD during phase planning

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 0/3 | Planning complete | - |
| 2. Core Application | 0/TBD | Not started | - |
| 3. Conflict System | 0/TBD | Not started | - |
| 4. Persistence & Export | 0/TBD | Not started | - |

---
*Roadmap created: 2026-02-12*
*Depth: quick (4 phases, 1-3 plans each)*
*Coverage: 26/26 v1 requirements mapped*
