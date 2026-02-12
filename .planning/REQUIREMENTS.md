# Requirements: Calculo Estacao

**Defined:** 2026-02-12
**Core Value:** O usuario informa o D-0 e o sistema calcula todas as datas de manejo para todos os lotes e rodadas, detectando e resolvendo conflitos automaticamente.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Calculo de Datas

- [ ] **CALC-01**: Usuario pode selecionar entre 3 protocolos pre-definidos (D0-D7-D9, D0-D8-D10, D0-D9-D11)
- [ ] **CALC-02**: Usuario pode criar protocolo customizado definindo os dias de manejo
- [ ] **CALC-03**: Sistema calcula todas as datas de manejo a partir do D0 para todos os lotes e rodadas
- [ ] **CALC-04**: Rodadas sao 4 por padrao (A1-A4), usuario pode adicionar ou remover
- [ ] **CALC-05**: Intervalo entre rodadas e 22 dias por padrao, configuravel por lote

### Gestao de Lotes

- [ ] **LOTE-01**: Sistema inicia com 5 lotes padrao (Primiparas, Secundiparas, Multiparas/Solteiras, Novilhas Tradicional, Novilhas Precoce)
- [ ] **LOTE-02**: Usuario pode adicionar novos lotes
- [ ] **LOTE-03**: Usuario pode remover lotes existentes
- [ ] **LOTE-04**: Usuario pode renomear lotes
- [ ] **LOTE-05**: Cada lote pode usar um protocolo diferente

### Conflitos

- [ ] **CONF-01**: Sistema detecta e marca em vermelho datas que caem no domingo
- [ ] **CONF-02**: Sistema detecta e marca em laranja quando dois lotes tem manejo no mesmo dia
- [ ] **CONF-03**: Usuario pode reposicionar D0 de lotes manualmente para resolver conflitos
- [ ] **CONF-04**: Auto-Stagger espaca D0s automaticamente (1 dia entre cada lote)
- [ ] **CONF-05**: Auto-Stagger permite travar lotes especificos
- [ ] **CONF-06**: Auto-Stagger mostra preview antes de aplicar
- [ ] **CONF-07**: Botao "Validar Tudo" analisa toda a estacao e sugere ajustes
- [ ] **CONF-08**: Algoritmo testa combinacoes de intervalos e D0s para encontrar melhor configuracao
- [ ] **CONF-09**: Resolucao em cadeia (resolver um conflito que cria outro)
- [ ] **CONF-10**: Se nao eliminar todos os conflitos, mostra a melhor opcao disponivel

### Visualizacao

- [ ] **VISU-01**: Tabela principal com caixas por rodada mostrando datas e dias de cada aplicacao
- [ ] **VISU-02**: Indicadores visuais de conflito (vermelho = domingo, laranja = sobreposicao)

### Exportacao

- [ ] **EXPO-01**: Exportar estacao completa em PDF formatado para impressao
- [ ] **EXPO-02**: Exportar estacao completa em Excel/CSV

### Persistencia

- [ ] **PERS-01**: Dados da estacao salvos automaticamente no localStorage
- [ ] **PERS-02**: Dados restaurados ao reabrir o app

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Exportacao Avancada

- **EXPO-03**: Exportar datas para iCalendar (.ics) para integracao com Google Calendar/Outlook

### Features Adicionais

- **FEAT-01**: Lista de insumos/materiais necessarios baseado nos protocolos
- **FEAT-02**: Comparacao de custos entre protocolos
- **FEAT-03**: Guia de selecao de protocolo baseado no tipo de gado

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| App mobile nativo | Web responsivo suficiente para v1 |
| Contas de usuario/autenticacao | Dados sao locais, sem necessidade de backend |
| Backend/servidor | Tudo client-side, zero infra |
| Rastreamento individual de animais | Trabalha no nivel de lote, nao individual |
| Gestao de rebanho completa | Escopo diferente (CattleMax, Farmbrite) |
| Multiplas estacoes simultaneas | Uma estacao por vez simplifica MVP |
| Colaboracao multi-usuario | Adiciona complexidade de sync/auth desnecessaria |
| Sync na nuvem | localStorage suficiente, sem custo de backend |
| Tracking de resultados reprodutivos | Ferramenta de planejamento, nao de analytics |
| Notificacoes push | Calendario impresso e export iCal suficientes |
| Funcionamento offline (PWA) | Usuario tera conexao |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CALC-01 | — | Pending |
| CALC-02 | — | Pending |
| CALC-03 | — | Pending |
| CALC-04 | — | Pending |
| CALC-05 | — | Pending |
| LOTE-01 | — | Pending |
| LOTE-02 | — | Pending |
| LOTE-03 | — | Pending |
| LOTE-04 | — | Pending |
| LOTE-05 | — | Pending |
| CONF-01 | — | Pending |
| CONF-02 | — | Pending |
| CONF-03 | — | Pending |
| CONF-04 | — | Pending |
| CONF-05 | — | Pending |
| CONF-06 | — | Pending |
| CONF-07 | — | Pending |
| CONF-08 | — | Pending |
| CONF-09 | — | Pending |
| CONF-10 | — | Pending |
| VISU-01 | — | Pending |
| VISU-02 | — | Pending |
| EXPO-01 | — | Pending |
| EXPO-02 | — | Pending |
| PERS-01 | — | Pending |
| PERS-02 | — | Pending |

**Coverage:**
- v1 requirements: 26 total
- Mapped to phases: 0
- Unmapped: 26 ⚠️

---
*Requirements defined: 2026-02-12*
*Last updated: 2026-02-12 after initial definition*
