# Calculo Estacao

## What This Is

Um web app que calcula automaticamente as datas de manejo da estacao de monta com IATF (Inseminacao Artificial em Tempo Fixo) para pecuaria de corte. Substitui a planilha Excel que tecnicos e produtores usam hoje para planejar protocolos reprodutivos, eliminando erros manuais e acelerando o planejamento.

## Core Value

O usuario informa a data do D-0 e o sistema calcula todas as datas de manejo para todos os lotes e rodadas, detectando e resolvendo conflitos automaticamente — sem erros, sem planilha.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Calculo automatico de datas de manejo para multiplos lotes e rodadas
- [ ] Deteccao de conflitos (domingos e sobreposicoes entre lotes)
- [ ] Resolucao inteligente de conflitos (ajuste de intervalos e D0)
- [ ] Auto-Stagger para espacamento automatico de lotes
- [ ] Gestao de lotes (adicionar, remover, renomear, protocolo por lote)
- [ ] Protocolos pre-definidos e personalizados
- [ ] Visualizacao em tabela com caixas por rodada
- [ ] Exportacao em PDF e Excel/CSV
- [ ] Dados salvos localmente (localStorage)

### Out of Scope

- App mobile nativo — web-first, responsivo serve
- Contas de usuario/autenticacao — dados sao locais
- Backend/servidor — tudo roda no navegador
- Historico de multiplas estacoes — uma estacao por vez
- Funcionamento offline (PWA) — usuario tera conexao

## Context

**Dominio:** Pecuaria de corte brasileira, especificamente estacao de monta com IATF.

**Protocolos IATF:** Sequencias de manejos em dias especificos (ex: D0-D7-D9, D0-D8-D10, D0-D9-D11). Cada manejo envolve procedimentos com o gado que nao podem cair no domingo e idealmente nao coincidem entre lotes diferentes.

**Rodadas:** Cada lote passa por multiplas rodadas de IATF (padrao 4: A1, A2, A3, A4). Intervalo padrao entre rodadas e 22 dias. Rodadas podem ser adicionadas ou removidas.

**Lotes padrao:** Primiparas, Secundiparas, Multiparas/Solteiras, Novilhas Tradicional, Novilhas Precoce.

**Conflitos:** Qualquer coincidencia de manejo entre dois lotes no mesmo dia = conflito (marcado em laranja). Manejo no domingo = conflito (marcado em vermelho).

**Resolucao de conflitos:**
- Pode aumentar intervalo entre rodadas (22 → 23, 24...)
- Pode mover D0 de lotes secundarios
- Resolve em cadeia (quando resolver um cria outro)
- Mostra melhor opcao se nao conseguir eliminar todos

**Auto-Stagger:** Espaca D0s automaticamente (1 dia entre cada lote), encontra melhores intervalos, permite travar lotes especificos, mostra preview antes de aplicar.

**Usuarios:** Tecnicos reprodutivos e produtores rurais. Interface precisa ser simples e direta.

**Exportacao:** PDF (para imprimir e levar a campo) e Excel/CSV (para quem quer manipular dados).

## Constraints

- **Timeline**: MVP rapido — precisa estar funcional logo
- **Stack**: Livre escolha (sera definido na pesquisa)
- **Infra**: Zero backend — tudo client-side, dados em localStorage
- **Compatibilidade**: Navegadores modernos (Chrome, Firefox, Edge)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Web app client-side only | Sem custo de servidor, deploy simples, dados locais | — Pending |
| Uma estacao por vez | Simplifica o MVP, maioria dos usuarios trabalha assim | — Pending |
| 4 rodadas padrao, configuravel | Cobre o caso comum mas permite flexibilidade | — Pending |

---
*Last updated: 2026-02-12 after initialization*
