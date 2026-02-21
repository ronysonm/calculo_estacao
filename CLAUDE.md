# CLAUDE.md

## Project Overview

Calculadora web para planejamento de estacao IATF (pecuaria de corte), com:
- calculo automatico de datas por lote e rodada
- deteccao de conflitos (domingo, sobreposicao e feriados)
- ajuste manual de D0 e gaps entre rodadas
- otimizacao automatica via worker (GA + CP-SAT para instancias pequenas)
- exportacao para PDF e Excel
- persistencia local com auto-save

Aplicacao 100% client-side (sem backend).

## Stack

- Preact 10 + TypeScript + Vite
- Estado reativo com `@preact/signals`
- Datas com `DateOnly` + `date-fns`
- Exportacao:
  - PDF: `jspdf` + `jspdf-autotable`
  - Excel: `exceljs`
- Testes: Vitest + jsdom

## Scripts

- `npm run dev` - desenvolvimento
- `npm run build` - type-check + build Vite
- `npm run preview` - preview local da build
- `npm test` - testes Vitest
- `npm run type-check` - checagem TypeScript

## Arquitetura (paths principais)

- `src/domain/value-objects/` - objetos de valor imutaveis (`DateOnly`, `Lot`, `Protocol`, `Conflict`, `Holiday`, `OptimizationScenario`)
- `src/core/date-engine/` - calculo de datas e utilitarios
- `src/core/conflict/` - detector, resolver, auto-stagger
- `src/core/optimization/` - motor de otimizacao (GA, CP-SAT, hibrido)
- `src/state/signals/` - estado global via signals
- `src/services/` - persistencia, exportacao, otimizacao
- `src/workers/optimizer.worker.ts` - execucao de otimizacao em background
- `src/components/` - UI principal (formulario, tabela, export, modal de cenarios)

## Regras de dominio (NAO quebrar)

1. `DateOnly` usa mes `1-12` (nao `0-11`).
2. Evitar aritmetica direta com `Date.setDate()`/`setMonth()`.
   Use `addDaysToDateOnly()` ou `DateOnly.addDays()`.
3. `roundGaps` representa o intervalo entre o ultimo dia do protocolo da rodada N e o D0 da rodada N+1.
4. Rodadas padrao: `4`.
5. Gaps padrao: `[22, 22, 22]`.
6. Conflitos:
   - `sunday`: manejo em domingo
   - `overlap`: lotes no mesmo dia
   - `holiday`: manejo em feriado (nacional ou personalizado)
   - UI combina `sunday` + `overlap` como `multiple`
   - Prioridade de exibicao: `multiple > sunday > overlap > holiday`

## Fluxo de estado

- `lotsSignal` e a fonte primaria.
- `handlingDatesSignal` e derivado de `lotsSignal`.
- `customHolidaysSignal` armazena feriados personalizados (persistidos por estacao).
- `allHolidaysSignal` combina feriados nacionais (expandidos por ano) + personalizados.
- `conflictsSignal` e `conflictSummarySignal` sao derivados de `handlingDatesSignal` + `allHolidaysSignal`.
- Persistencia:
  - hook `usePersistence()` faz load inicial e auto-save com debounce.
  - storage key: `estacao-iatf-data`.
  - monitoramento de quota com alertas.
- Otimizacao:
  - estado em `src/state/signals/optimization.ts`.

## Otimizacao (como funciona hoje)

- UI chama `optimizerService.optimizeSchedule(...)`.
- Servico usa execucao single-flight e worker request-scoped, com timeout robusto.
- Worker valida payload e chama `optimizeWithHybridEngine(...)`.
- Hibrido:
  - CP-SAT para instancias pequenas (`cpSatLotThreshold`)
  - fallback para GA em instancias maiores ou falha do CP-SAT
- Resultado: ate 4 cenarios + estatistica de combinacoes avaliadas.

## Convencoes de codigo

- Preservar imutabilidade dos value objects (`withD0`, `withProtocol`, etc.).
- Manter aliases (`@/...`) conforme `vite.config.ts` e `tsconfig.json`.
- Preferir textos de UI em portugues (padrao atual).
- Nao introduzir backend sem solicitacao explicita.
- Se alterar persistencia, considerar versionamento/migracao de schema (`VERSION` em storage).

## Testes e qualidade

- Adicionar/atualizar testes Vitest junto de mudancas de regra de negocio.
- Para mudancas estocasticas na otimizacao, usar RNG controlado em testes
- Ao final de cada alteração execute todos os testes
- Verifica e desenvolva novos testes para todo código gerado
- Rodar no minimo:
  - `npm run type-check`
  - `npm test`

## Documentacao de apoio

- `resources/README.md`
- `resources/QUICK_START.md`
- `resources/SPEC.md`
- `resources/PRD.md`
- `resources/FIX.md`
- `resources/FIX_CHANGES.md`
- `resources/OPTIMIER.md`
