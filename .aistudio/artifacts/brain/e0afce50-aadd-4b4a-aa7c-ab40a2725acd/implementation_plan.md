# Jogos Efetivados (Lotérica) e Conferidor de Premiação

Estruturação da seção **Jogos** em três abas claras (**`Criar Jogo`** | **`Jogos Realizados`** | **`Conferidor`**), permitindo ao usuário efetivar palpites para apostar na casa lotérica, controlar o status de registro (**A Fazer** vs. **Feito na Lotérica**) e conferir automaticamente ou manualmente se seus jogos foram premiados.

## User Review & Critical Decisions

> [!IMPORTANT]
> As decisões abaixo refletem exatamente as suas escolhas confirmadas:

- **Decisão Confirmada 1 — Navegação em 3 Abas na Seção Jogos**: A seção **Jogos** passa a contar com uma barra de 3 abas logo abaixo do seletor de loteria: **`Criar Jogo`**, **`Jogos Realizados`** e **`Conferidor`**.
- **Decisão Confirmada 2 — Controle de Status para Casa Lotérica**: Na aba **`Jogos Realizados`**, cada jogo efetivado pode alternar com 1 toque entre **`A Fazer`** (separado para levar/registrar na lotérica) e **`Feito na Lotérica`** (já registrado), com filtro rápido e resumo de custo (`X DZ - R$ XX,XX`).
- **Decisão Confirmada 3 — Conferência Híbrida (Automática + Manual)**: Na aba **`Conferidor`** (e refletida nos jogos efetivados), o usuário pode alternar entre a **Conferência Automática** (usando o resultado oficial do concurso atual da loteria selecionada) e a **Conferência Manual** (selecionando ou digitando as bolas sorteadas), exibindo imediatamente quantos acertos cada jogo teve e se foi **Premiado** (ex.: *Quadra*, *Quina*, *Sena*, *11 a 15 pontos*, etc.) ou **Não Premiado**.

---

## 1. Overview & Core Concept

- **O que faz**: Transforma a seção **Jogos** em um fluxo completo de ponta a ponta — desde a geração inteligente das dezenas (**Criar Jogo**), passando pela separação e controle financeiro dos jogos que serão registrados na lotérica (**Jogos Realizados**), até a apuração imediata de acertos e faixas de prêmio (**Conferidor**).
- **Público-Alvo**: Jogadores individuais e participantes de bolões que utilizam o aplicativo para planejar suas apostas, controlar o que ainda precisam registrar na lotérica e conferir seus bilhetes sem esforço manual.
- **Valor Principal**: Elimina a confusão entre "palpites gerados para teste" e "jogos efetivamente escolhidos para apostar na lotérica", além de entregar conferência instantânea de premiação para todas as modalidades da Caixa.

---

## 2. User Experience & Visual Design

- **Fluxo Passo a Passo do Usuário**:
  1. **Aba `Criar Jogo`**: O usuário gera seus palpites normalmente. Em cada jogo gerado, além de *Imprimir* e *Copiar*, há o botão **`Efetivar`** (em verde Caixa `#008B47`). Ao tocar em **`Efetivar`**, o jogo é salvo na lista de **Jogos Realizados** (inicialmente com status **`A Fazer`**). Também é possível criar e efetivar um jogo manualmente escolhendo as dezenas.
  2. **Aba `Jogos Realizados`**:
     - Exibe um resumo superior limpo com o total de jogos efetivados e o valor total justificado (`X jogos · R$ XX,XX`).
     - Filtro rápido em 3 opções simples: **`Todos`**, **`A Fazer`** e **`Feitos`**.
     - Em cada card de jogo efetivado: exibe o número do jogo, modalidade, justificativa de valor (**`X DZ - R$ XX,XX`**), dezenas escolhidas, um botão de alternância rápida **`A Fazer`** ↔ **`Feito na Lotérica`**, botão **`Imprimir`** (volante) e botão **`Excluir`**.
  3. **Aba `Conferidor`**:
     - **Seletor de Modo de Conferência**: **`Automática (Concurso Atual)`** vs. **`Manual (Inserir Dezenas)`**.
     - No modo **Automático**, carrega as bolas sorteadas do último concurso da loteria ativa.
     - No modo **Manual**, abre o volante/seletor de bolas sorteadas para o usuário tocar nas dezenas do sorteio (com botão **`Limpar`**).
     - **Painel de Resultado da Conferência**: Lista todos os **Jogos Realizados** daquela loteria, destacando em verde as dezenas acertadas, a contagem de acertos (`X acertos`) e o selo claro do resultado: **`PREMIADO — [Faixa de Prêmio]`** (ex.: *Quadra*, *Quina*, *Sena*, *14 Pontos*) ou **`Não premiado`**.

- **Identidade Visual & Tema**:
  - **Estética**: Utilitário bancário/lotérico limpo inspirado no padrão Caixa (`#005CA9` azul institucional, `#008B47` verde confirmação/premiação, `#F7F9FC` fundo neutro).
  - **Tipografia e Números Tabulares**: Dezenas, custos (`X DZ - R$ XX,XX`) e contagens utilizam fonte tabular (`font-mono-tabular`) para alinhamento vertical perfeito em telas mobile de `375px–430px`.
  - **Zero Box-Inside-Box**: Cada aba renderiza seus cards diretamente sobre o canvas, sem caixas aninhadas desnecessárias ou textos vazando.

---

## 3. Key Product Decisions & Trade-Offs

- **Decisão 1 — Separação entre Palpites Temporários e Jogos Efetivados**:
  - *Abordagem Escolhida*: Palpites recém-gerados ficam em `Criar Jogo`; apenas os jogos que o usuário clica em **`Efetivar`** vão para `Jogos Realizados`.
  - *Por quê*: O usuário costuma gerar 5 ou 10 palpites de teste antes de decidir quais 2 ou 3 realmente vai pagar na lotérica. Separar a "Efetivação" mantém a lista da lotérica limpa e com o valor financeiro exato.
- **Decisão 2 — Persistência no Perfil do Usuário**:
  - *Abordagem Escolhida*: Os jogos efetivados (`effectiveGames`) são salvos junto aos dados do usuário no estado persistente (API/cache local), preservando o status (`A_FAZER` ou `FEITO`) entre sessões.
  - *Por quê*: Garante que o usuário possa efetivar seus jogos em casa, abrir o app na fila da lotérica para marcar como **`Feito na Lotérica`** e conferir o resultado à noite após o sorteio.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       SEÇÃO JOGOS (UserAreaTab)                         │
│  ┌───────────────────────────────────┬───────────────────────────────┐  │
│  │      Loteria Ativa (Mega-Sena)    │          + Loterias ▾         │  │
│  ├───────────────────────┬───────────┴───────────┬───────────────────┤  │
│  │      Criar Jogo       │   Jogos Realizados    │    Conferidor     │  │
│  └───────────┬───────────┴───────────┬───────────┴─────────┬─────────┘  │
└──────────────┼───────────────────────┼─────────────────────┼────────────┘
               │                       │                     │
               ▼                       ▼                     ▼
  ┌────────────────────────┐ ┌────────────────────┐ ┌────────────────────┐
  │ • Gerador Estatístico  │ │ • Filtro: Todos /  │ │ • Modo Automático  │
  │ • Lista de Gerados     │ │   A Fazer / Feitos │ │   (Último Sorteio) │
  │ • Botão [Efetivar] ────┼─► • Card X DZ-R$ XX  │ │ • Modo Manual      │
  │   salva como A_FAZER   │ │ • Toggle Status:   │ │   (Bolas Sorteadas)│
  └────────────────────────┘ │   A Fazer ↔ Feito  │ │ • Apuração de Faixa│
                             └─────────┬──────────┘ │   Premiado / Não   │
                                       └───────────►└────────────────────┘
```

- **Modelo de Dados (`EffectiveGame`)**:
  - `id`: identificador único do jogo efetivado.
  - `lotteryType`: modalidade (`MEGA_SENA`, `LOTOFACIL`, `QUINA`, `LOTOMANIA`, `DUPLA_SENA`, `TIMEMANIA`, `DIA_DE_SORTE`).
  - `numbers`: array de dezenas ordenadas.
  - `cost`: valor oficial da aposta conforme quantidade de dezenas (`X DZ - R$ XX,XX`).
  - `status`: `'A_FAZER' | 'FEITO'` (status de registro na casa lotérica).
  - `contestNumber`: número do concurso de referência.
  - `createdAt`: data e hora da efetivação.
- **Regras de Apuração de Premiação por Modalidade (`evaluatePrizeTier`)**:
  - **Mega-Sena**: 6 acertos (*Sena*), 5 acertos (*Quina*), 4 acertos (*Quadra*).
  - **Lotofácil**: 11 a 15 acertos (*11 a 15 Pontos*).
  - **Quina**: 2 a 5 acertos (*Duque*, *Terno*, *Quadra*, *Quina*).
  - **Lotomania**: 15 a 20 acertos ou 0 acertos.
  - **Dupla Sena**: 3 a 6 acertos (*Terno*, *Quadra*, *Quina*, *Sena*).
  - **Timemania**: 3 a 7 acertos.
  - **Dia de Sorte**: 4 a 7 acertos.
