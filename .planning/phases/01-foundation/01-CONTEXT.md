# Phase 1: Foundation - Context

**Gathered:** 2026-02-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish project infrastructure (React + TypeScript + Vite) and bulletproof date calculation engine with domain model. Protocols (pre-defined and custom) are represented as immutable domain objects. Multiple rounds calculate with configurable intervals per lot. No UI beyond what's needed for testing — UI is Phase 2.

</domain>

<decisions>
## Implementation Decisions

### Pre-defined protocols
- 3 protocolos padrão: D0-D7-D9, D0-D8-D10, D0-D9-D11
- Nomeados pela sequência de dias (ex: "D0-D7-D9"), sem nome descritivo
- Cada protocolo tem exatamente 3 manejos (D0 + 2 subsequentes)
- Manejos referenciados apenas pelo dia (D0, D7, D9), sem descrição do procedimento
- Pré-definidos são fixos — não podem ser editados ou deletados

### Custom protocol rules
- Usuário informa os 3 dias diretamente (ex: D0, D8, D10)
- Sem restrição de validação — usuário pode colocar qualquer dia
- Protocolos customizados são salváveis — ficam na lista junto com pré-definidos
- Customizados podem ser editados e deletados

### Round configuration
- Padrão: 4 rodadas (A1-A4), configurável de 1 a 6
- Número de rodadas é global — todos os lotes da estação têm o mesmo número
- Intervalo entre rodadas: padrão 22 dias, configurável por lote
- Intervalo único por lote (todas as transições A1→A2, A2→A3 etc usam o mesmo valor)
- Sem restrição na faixa do intervalo — usuário define o valor

### Tech stack
- React + TypeScript + Vite
- Tailwind CSS + Shadcn/ui para componentes
- date-fns para cálculos de data (já definido nos success criteria)

### Claude's Discretion
- Estrutura de pastas e organização do código
- Padrão de state management (Context, Zustand, etc)
- Estratégia de testes (Vitest, testing patterns)
- Formato interno dos domain objects

</decisions>

<specifics>
## Specific Ideas

- Protocolos sempre têm exatamente 3 manejos — simplifica o modelo de domínio
- Técnicos pensam em "dias" (D0, D7, D9), não em procedimentos — interface deve refletir isso
- Usuário confia no que está fazendo — validações mínimas, sem restringir valores

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-02-12*
