# Central de Impressão de Volantes & Exportação PDF (Padrão Lotérico Caixa)

Ferramenta dedicada para imprimir os **jogos aprovados e travados do bolão** diretamente sobre os cartões físicos oficiais das Loterias Caixa (ou em folha A4 com molde óptico para recorte) e exportar arquivos **PDF em escala milimétrica real (100%)**, acessível por um novo botão fixo **Imprimir** no menu inferior do bolão.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> **Decisões Confirmadas pelo Usuário:**
> - **3 Modos de Impressão Integrados**:
>   1. **Direto no Cartão Oficial da Caixa ($83\text{ mm} \times 158\text{ mm}$)**: Imprime exclusivamente os alvéolos pretos (`■`) sobre o volante físico inserido no alimentador da impressora.
>   2. **Folha-Guia A4 para 3 Cartões Oficiais (Sobrepor em A4)**: Permite imprimir uma folha-guia A4, fixar até 3 cartões oficiais da Caixa lado a lado e imprimir as marcações pretas sobre os 3 cartões simultaneamente (solucionando impressoras que não puxam papel estreito de $8,3\text{ cm}$).
>   3. **Molde Completo em Folha A4 para Recortar**: Desenha até 3 volantes completos por folha A4 com as barras laterais de sincronismo óptico do terminal lotérico e linhas de corte para guilhotina/tesoura.
> - **Escopo Estrito de Jogos**: Entram na fila de impressão e no PDF **somente os jogos já aprovados e travados pelo organizador**, agrupados automaticamente de **3 em 3 jogos por cartão** (Quadro 1, Quadro 2 e Quadro 3 do volante).
> - **Acesso pelo Menu Inferior do Bolão**: Novo botão fixo **Imprimir** posicionado na barra inferior exclusiva do bolão.

---

## 1. Overview & Core Concept

- **O Que Faz**: Transforma a lista de volantes aprovados do bolão em gabaritos milimétricos prontos para leitura óptica nos terminais das casas lotéricas (Mega-Sena, Lotofácil e Quina), eliminando o preenchimento manual à caneta de dezenas de cartões.
- **Público-Alvo**: Organizadores e participantes do bolão que precisam levar os jogos aprovados para registro físico na lotérica com rapidez e zero erro de marcação.
- **Valor Principal**:
  - Agrupamento automático de até **3 jogos aprovados por cartão físico** (economizando cartões e tempo na fila da lotérica).
  - **Calibração Fina Milimétrica (Offset X e Y em mm)** com modo *"Folha de Teste Contra a Luz"* para alinhar qualquer impressora jato de tinta ou laser (HP, Epson, Canon, Brother) antes de alimentar os cartões reais.
  - **Geração de PDF Vetorial em Escala 100% Real** para baixar, enviar por WhatsApp ou imprimir em qualquer computador.

---

## 2. User Experience & Visual Design

### Fluxo Passo a Passo do Usuário
1. **Acesso Direto pelo Rodapé do Bolão**:
   - Na barra inferior do bolão (**Voltar | Participantes | Pagamentos | Volantes | Imprimir | Estatísticas**), o usuário toca em **Imprimir**.
2. **Seleção do Modo de Impressão (3 Abas Visuais)**:
   - **Direto no Cartão (83×158mm)**: Configura a página no formato exato do volante avulso da Caixa, renderizando apenas os quadradinhos pretos (`#000000` 100% sólido) das dezenas e da quantidade de números apostados.
   - **Guia A4 (3 Cartões Colados)**: Exibe a opção de imprimir primeiro a *Folha-Guia A4* (com os 3 retângulos demarcados para posicionar os volantes físicos com fita adesiva removível) e, em seguida, disparar a impressão apenas das marcações pretas sobre os 3 cartões de uma só vez.
   - **Molde A4 (Recortar)**: Renderiza até 3 volantes completos lado a lado na folha A4 paisagem/retrato, incluindo cabeçalho da modalidade, grades numeradas, alvéolos preenchidos em preto sólido, **barras pretas laterais de sincronismo óptico (timing tracks)** exigidas pela leitora da Caixa e linhas tracejadas de recorte.
3. **Calibrador Milimétrico ("Teste Contra a Luz")**:
   - Painel rápido com ajustes de **Margem Horizontal X ($\text{mm}$)** e **Margem Vertical Y ($\text{mm}$)** em passos de $0,5\text{ mm}$ (ex.: `-2,5 mm` a `+5,0 mm`), além de ajuste de largura/altura do alvéolo, salvos automaticamente para a impressora do usuário.
   - Botão **Imprimir 1 Jogo de Teste** para conferir contra a luz sobre um volante físico antes de rodar o lote inteiro.
4. **Fila de Cartões Aprovados & Ações Finais**:
   - Mostra apenas os **Jogos Definidos/Aprovados** do bolão, agrupados em **Cartão #01 (Jogos 1 a 3)**, **Cartão #02 (Jogos 4 a 6)**, etc., com pré-visualização gráfica em tempo real do cartão e das marcações pretas.
   - Dois botões principais lado a lado: **Imprimir** (aciona a impressão nativa na escala 100%) e **Exportar PDF** (gera e baixa o arquivo `.pdf` em tamanho real milimétrico).

### Identidade Visual & Ergonomia Mobile
- **Paleta Institucional Caixa**: Azul (`#005CA9`) para seleção de modos e controles, Verde (`#008B47`) para confirmação e exportação, e pré-visualização técnica do volante com alvéolos em preto puro (`#000000`) sobre fundo rosa/laranja/azul suave (no modo prévia) que fica 100% invisível no momento da impressão direta no cartão oficial.
- **Tipografia Tabular**: Coordenadas em milímetros (`mm`), números de concursos e dezenas em fonte monoespaçada tabular (`font-mono-tabular`).

---

## 3. Key Product Decisions & Trade-Offs

- **Decisão 1: Agrupamento Automático de 3 Jogos por Cartão Físico**
  - *Abordagem Escolhida*: Cada volante oficial da Caixa comporta até 3 apostas independentes (Quadro 1, Quadro 2 e Quadro 3). A ferramenta agrupa automaticamente os jogos aprovados de 3 em 3 por cartão físico (com opção de 1 jogo por cartão caso o usuário prefira).
  - *Por quê*: Reduz em até 3 vezes a quantidade de cartões físicos necessários na impressora e no caixa da lotérica.
- **Decisão 2: Renderização Vetorial em Milímetros (`mm`) + PDF Nativo em Escala 100%**
  - *Abordagem Escolhida*: Construir o motor de desenho dos cartões usando coordenadas reais em milímetros (convertidas em pontos/pixels exatos de $300\text{ DPI}$ para o gerador de PDF e CSS `@page { size: ...; margin: 0; }` para impressão direta).
  - *Por quê*: As leitoras ópticas dos terminais lotéricos rejeitam impressões com distorção de escala ("Ajustar à página"). O PDF gerado com dimensões físicas exatas ($210 \times 297\text{ mm}$ para A4 ou $83 \times 158\text{ mm}$ para volante avulso) garante precisão milimétrica.

---

## 4. Technical Architecture & Data Strategy

```
┌─────────────────────────────────────────────────────────────────────────┐
│                RODAPÉ EXCLUSIVO DA SEÇÃO DO BOLÃO (6 Botões)            │
│  [Voltar]  [Participantes]  [Pagamentos]  [Volantes]  [Imprimir] [Est.] │
└───────────────────────────────────────────────────────────┬─────────────┘
                                                            │
                                                            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│             PoolPrintTab (Central de Impressão & Exportação PDF)        │
├─────────────────────────────────────────────────────────────────────────┤
│  1. Filtro Estrito: Somente Jogos Aprovados e Travados (poolGames)      │
│  2. Agrupador de Cartões: Empacota de 3 em 3 jogos (Quadros 1, 2 e 3)   │
│  3. Seletor dos 3 Modos:                                                │
│     ├─ [Direto no Cartão 83x158mm] -> Só alvéolos pretos (sem fundo)    │
│     ├─ [Guia A4 p/ 3 Cartões]      -> Gabarito de colagem + Sobrepor    │
│     └─ [Molde A4 Completo]         -> Volante + Barras Ópticas + Corte  │
│  4. Calibrador Milimétrico (Salvo no localStorage por Loteria):         │
│     └─ Offset X (mm), Offset Y (mm), Espaçamento entre Quadros (mm)     │
└──────────────────────┬────────────────────────────────────┬─────────────┘
                       │                                    │
                       ▼                                    ▼
┌────────────────────────────────────────┐ ┌──────────────────────────────┐
│   Motor de Impressão Direta (@media)   │ │  Gerador PDF 100% Escala     │
│ • Injeta @page (A4 ou 83mm x 158mm)    │ │ • Desenha coordenadas exatas │
│ • Oculta UI do app durante impressão   │ │   em mm (210x297 ou 83x158)  │
│ • Imprime alvéolos #000000 100% opacos │ │ • Baixa arquivo .pdf pronto  │
└────────────────────────────────────────┘ └──────────────────────────────┘
```

### Mapeamento de Estado e Interações
- **Persistência de Calibração**: Os ajustes de `offsetXMm`, `offsetYMm`, `slotGapMm` e `cellWidthMm` são persistidos no navegador por modalidade (`MEGA_SENA`, `LOTOFACIL`, `QUINA`), permitindo que o organizador calibre sua impressora uma única vez.
- **Seleção Individual de Cartões**: Todos os cartões aprovados iniciam selecionados por padrão, mas o usuário pode marcar/desmarcar cartões específicos (ex.: reimprimir apenas o Cartão #02 caso tenha colocado o papel torto).
- **Folha-Guia A4 em 2 Cliques**: No modo *Guia A4 para 3 Cartões*, um botão **1º Imprimir Folha-Guia** imprime os contornos de onde encaixar os 3 volantes da Caixa, e o botão **2º Imprimir Jogos sobre os Cartões** imprime apenas os quadradinhos pretos nas posições exatas.
