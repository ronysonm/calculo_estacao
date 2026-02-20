# Calculadora de Estação IATF

Aplicação web para planejamento automático de manejos em estações de IATF (Inseminação Artificial em Tempo Fixo) para pecuária de corte.

## Funcionalidades

### ✅ Fase 1: Cálculo de Datas (Completo)
- [x] Motor de cálculo de datas sem bugs de timezone
- [x] Suporte a 3 protocolos predefinidos (D0-D7-D9, D0-D8-D10, D0-D9-D11)
- [x] Cálculo automático de 4 rodadas (A1-A4)
- [x] Intervalo de 22 dias entre rodadas
- [x] Tratamento correto de limites de mês e ano
- [x] Suporte a anos bissextos

### ✅ Fase 2: Interface de Usuário (Completo)
- [x] 5 lotes padrão pré-configurados
- [x] Adicionar/remover lotes
- [x] Renomear lotes
- [x] Alterar data D0
- [x] Selecionar protocolo por lote
- [x] Tabela responsiva com formato Excel
- [x] Indicadores visuais de conflitos (vermelho/laranja)

### ✅ Fase 3: Sistema de Conflitos (Completo)
- [x] Detecção de domingos (fazenda fechada)
- [x] Detecção de sobreposições entre lotes
- [x] Ajuste manual de D0 para resolver conflitos
- [x] Auto-espaçar com travamento de lotes
- [x] Prévia antes de aplicar auto-espaçamento
- [x] Resolver tudo (CSP solver)
- [x] Resolução em <2s mesmo com configurações impossíveis
- [x] Resolução em cadeia (não cria novos conflitos)
- [x] Mostra melhor opção quando não consegue resolver tudo

### ✅ Fase 4: Persistência e Exportação (Completo)
- [x] Auto-salvamento em localStorage
- [x] Auto-carregamento ao abrir
- [x] Monitoramento de cota de armazenamento
- [x] Alertas em 80% e 95% de uso
- [x] Tratamento de modo incógnito
- [x] Exportar para PDF com cores de conflito
- [x] Exportar para Excel (.xlsx)
- [x] Imprimir com CSS otimizado
- [x] Legenda de cores em exportações

## Tecnologias

- **Preact 10** - Framework UI (3KB vs 40KB do Vue)
- **@preact/signals** - Gerenciamento de estado reativo
- **date-fns v4** - Manipulação segura de datas
- **Tabulator 6** - Tabela de alta performance
- **jsPDF** - Geração de PDF
- **SheetJS (xlsx)** - Geração de Excel
- **TypeScript** - Type safety
- **Vite** - Build tool

## Instalação

```bash
# Instalar dependências
npm install

# Desenvolvimento
npm run dev

# Build para produção
npm run build

# Executar testes
npm test

# Preview da build
npm run preview
```

## Uso

### 1. Gerenciar Lotes

- **Adicionar Lote**: Preencha nome, D0 e protocolo, clique "Adicionar Lote"
- **Remover Lote**: Clique "Remover" no card do lote
- **Alterar D0**: Use o seletor de data no card do lote
- **Alterar Protocolo**: Use o dropdown no card do lote

### 2. Visualizar Calendário

A tabela mostra todas as datas de manejo para todos os lotes:
- **Colunas**: Lote | A1 D0 | A1 D7 | A1 D9 | ... | A4 D11
- **Células Vermelhas**: Domingos (fazenda fechada)
- **Células Laranjas**: Sobreposição de lotes
- **Formato**: dd/mm/aaaa (Dia)

### 3. Resolver Conflitos

#### Auto-Espaçar
1. Clique "📅 Auto-Espaçar"
2. Defina espaçamento (padrão: 1 dia)
3. Opcionalmente clique "Calcular Ótimo"
4. Trave lotes que não devem mover (checkbox)
5. Revise a prévia
6. Clique "Aplicar"

#### Validar Tudo
1. Clique "🔍 Validar Tudo"
2. O sistema tenta resolver automaticamente
3. Se bem-sucedido, aplica as mudanças
4. Se parcial, pergunta se quer aplicar a melhor solução
5. Mostra número de iterações e tempo

### 4. Exportar

- **PDF**: Clique "📄 Exportar PDF" - gera arquivo com cores
- **Excel**: Clique "📊 Exportar Excel" - gera .xlsx ordenável
- **Imprimir**: Clique "🖨️ Imprimir" - abre diálogo de impressão

## Prevenção de Erros

A aplicação foi projetada para evitar 8 armadilhas comuns:

### ✅ Pitfall #1: Month off-by-one
**Prevenção**: `DateOnly` usa meses 1-12 (não 0-11 como JavaScript)

### ✅ Pitfall #2: Timezone bugs
**Prevenção**: `DateOnly` armazena `{year, month, day}`, nunca ISO strings

### ✅ Pitfall #3: Month overflow
**Prevenção**: Usa `date-fns addDays()`, nunca `Date.setDate()`

### ✅ Pitfall #4: CSP exponencial
**Prevenção**: Algoritmo guloso, limite de 10k iterações, timeout de 2s

### ✅ Pitfall #5: localStorage quota
**Prevenção**: try-catch em todos os writes, alertas em 80%/95%

### ✅ Pitfall #6: Print CSS quebrado
**Prevenção**: `page-break-inside: avoid`, cabeçalhos repetem

### ✅ Pitfall #7: Datas do Excel como texto
**Prevenção**: Formato XLSX, células tipo Date, formato dd/mm/aaaa

### ✅ Pitfall #8: Performance da tabela
**Prevenção**: Debounce 300ms, memoização, React.memo

## Arquitetura

```
src/
├── domain/          # Objetos de valor imutáveis
│   ├── value-objects/
│   │   ├── DateOnly.ts     # Previne bugs de timezone
│   │   ├── Protocol.ts     # Protocolo imutável
│   │   ├── Lot.ts          # Lote imutável
│   │   ├── HandlingDate.ts # Data de manejo
│   │   └── Conflict.ts     # Conflito
│   └── constants.ts        # Protocolos e nomes padrão
│
├── core/            # Lógica de negócio pura
│   ├── date-engine/
│   │   ├── calculator.ts   # Cálculo de datas
│   │   └── utils.ts        # Wrappers date-fns
│   └── conflict/
│       ├── detector.ts     # Detecção de conflitos
│       ├── resolver.ts     # CSP solver
│       └── auto-stagger.ts # Auto-espaçamento
│
├── state/           # Gerenciamento de estado
│   └── signals/
│       ├── lots.ts         # Signal de lotes + ações
│       └── conflicts.ts    # Signals derivados
│
├── components/      # Componentes UI
│   ├── Table/
│   ├── Forms/
│   ├── Conflict/
│   └── Export/
│
├── services/        # Infraestrutura
│   ├── persistence/
│   │   └── storage.ts      # localStorage adapter
│   └── export/
│       ├── pdf-generator.ts
│       └── excel-generator.ts
│
├── hooks/           # React hooks customizados
├── utils/           # Utilitários (debounce, etc)
└── styles/          # CSS global e de componentes
```

## Estrutura de Dados

### DateOnly
```typescript
{
  year: 2026,
  month: 1,    // 1-12 (NÃO 0-11)
  day: 15
}
```

### Protocol
```typescript
{
  id: "protocol-1",
  name: "D0-D7-D9",
  intervals: [0, 7, 9],
  type: "D0-D7-D9"
}
```

### Lot
```typescript
{
  id: "lot-1",
  name: "Primíparas",
  d0: DateOnly,
  protocol: Protocol,
  roundInterval: 22
}
```

## Testes

Testes unitários cobrem casos críticos:
- ✅ Jan 31 + 1 dia = Feb 1 (não Mar 3)
- ✅ Dec 31 + 1 dia = Jan 1 (próximo ano)
- ✅ Feb 28, 2028 + 1 dia = Feb 29 (ano bissexto)
- ✅ Detecção correta de domingos
- ✅ 4 rodadas com intervalo de 22 dias
- ✅ Timezone consistency

```bash
npm test
```

## Limites Conhecidos

- **localStorage**: ~5-10MB (alerta em 80%)
- **CSP solver**: 10.000 iterações, timeout 2s
- **Exportação**: Baseado em dados em memória (sem paginação)
- **Tabulator**: Performance degrada com >100 lotes

## Próximas Funcionalidades (Futuro)

- [ ] Protocolos customizados
- [ ] Intervalos de rodada personalizados por lote
- [ ] Templates de estação
- [ ] Histórico de alterações (undo/redo)
- [ ] Compartilhamento via URL
- [ ] Sincronização em nuvem
- [ ] Modo offline com Service Worker

## Contribuindo

1. Fork o repositório
2. Crie uma branch (`git checkout -b feature/nova-funcionalidade`)
3. Commit suas mudanças (`git commit -m 'Add: nova funcionalidade'`)
4. Push para a branch (`git push origin feature/nova-funcionalidade`)
5. Abra um Pull Request

## Licença

MIT License - veja LICENSE para detalhes

## Suporte

Para reportar bugs ou solicitar funcionalidades, abra uma issue no GitHub.

---

**Desenvolvido para produtores e técnicos de pecuária de corte no Brasil** 🐂🇧🇷
