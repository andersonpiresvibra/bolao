# Plano de Implementação: Gerador Inteligente de Palpites, Seções em Tela Inteira e Menu do Avatar

## 1. Visão Geral do Produto
Vamos evoluir a **Frente Usuário (`Meu Espaço`)** com três melhorias estruturais solicitadas:
1. **Navegação em Seções de Tela Inteira (Zero Modais)**: Todas as funcionalidades abertas pelos cards do *Meu Espaço* (e pelo menu do usuário) deixarão de abrir como janelas flutuantes (modais) e passarão a abrir como **seções de tela inteira** dentro do aplicativo, com cabeçalho próprio e botão *"Voltar ao Meu Espaço"*.
2. **Menu do Avatar do Usuário**: Ao clicar no avatar/identificação do participante no topo, abrirá um menu rápido contendo **Meu Perfil** (movido da grade de cards para este menu), atalho para **Gerador de Palpites**, **Meus Investimentos (Jogo Responsável)** e opção de **Sair / Trocar Conta**.
3. **Gerador Inteligente de Palpites**: O espaço deixado pelo card *Meu Perfil* na grade 3x3 passará a ser o card dedicado **Gerador de Palpites** (também acessível dentro de *Meus Palpites* e pelo *Menu do Avatar*), permitindo criar combinações otimizadas com estatísticas reais das Loterias CAIXA.

---

## 2. Arquitetura e Funcionalidades Detalhadas

### A. Fonte de Dados de Dezenas Mais Quentes e Mais Frias (API + Fallback Oficial)
- **Rota Backend (`/api/lottery-stats/:lotteryType` em `server.ts`)**:
  - Consulta dados atualizados de resultados das Loterias CAIXA (Mega-Sena, Lotofácil e Quina) em API pública de resultados de loterias, consolidando os últimos sorteios e o ranking histórico oficial de frequência de todas as dezenas do volante (ex.: 01 a 60 na Mega-Sena, 01 a 25 na Lotofácil, 01 a 80 na Quina).
  - Caso a API externa esteja indisponível ou lenta, o servidor responde instantaneamente com a tabela completa de frequência histórica oficial da CAIXA para cada dezena, garantindo funcionamento 100% contínuo e transparente.
  - Exibe no gerador as badges visuais das **Top Dezenas Mais Quentes (🔥 maior frequência)** e **Top Dezenas Mais Frias (❄️ menor frequência / mais atrasadas)** da modalidade escolhida.

### B. Regras e Controles do Gerador Inteligente de Palpites
- **Escolha da Modalidade e Quantidade**:
  - Seletor da loteria (**Mega-Sena**, **Lotofácil** ou **Quina**), quantidade de dezenas por jogo (respeitando o mínimo e máximo oficiais da CAIXA) e **quantidade de jogos a gerar simultaneamente (1 a 10 palpites de uma vez)**.
- **Filtros de Dezenas do Usuário**:
  1. **Usar Minhas Dezenas Favoritas**: Chave (toggle) para priorizar ou incluir automaticamente as dezenas cadastradas pelo usuário em *Dezenas Favoritas*.
  2. **Dezenas Fixas ("Para Ajudar o Sistema")**: Volante interativo onde o usuário toca para fixar dezenas obrigatórias que devem estar presentes em todos os palpites gerados.
  3. **Dezenas Excluídas ("Não Desejo no Palpite")**: Seletor onde o usuário marca dezenas que o algoritmo é proibido de sortear (com bloqueio automático de conflito entre fixas e excluídas).
- **Mistura de Dezenas Quentes e Frias (Todas as Opções)**:
  - **Botões de Modo Rápido**: *Equilibrado (50% Quentes / 50% Frias)*, *Mais Quentes (Foco nas mais sorteadas)*, *Mais Frias (Foco nas atrasadas)* e *Aleatório Livre*.
  - **Controle Deslizante (Slider de Proporção Exata)**: Permite ajustar manualmente a porcentagem exata entre **% Quentes** e **% Frias** (ex.: 70% Quentes / 30% Frias), calculando quantas dezenas restantes virão do grupo quente e quantas virão do grupo frio.

### C. Ações Pós-Geração do Palpite
Para cada palpite (ou lote de palpites) gerado na tela, o usuário terá botões diretos para:
1. **Enviar direto para o Bolão Ativo**: Registra o palpite imediatamente na lista de sugestões de jogos do bolão aberto da mesma modalidade.
2. **Salvar em Meus Jogos Favoritos**: Guarda a combinação com nome personalizado na biblioteca pessoal do usuário.
3. **Copiar Dezenas / Compartilhar**: Copia os jogos formatados (ex.: `Mega-Sena: 04 - 10 - 23 - 37 - 42 - 53`) para a área de transferência ou compartilhamento nativo do celular (`navigator.share`).

### D. Menu do Avatar e Navegação em Tela Inteira
- **Menu do Avatar**: No cabeçalho do usuário (`MobileHeader` e topo do `Meu Espaço`), clicar no avatar com as iniciais abre um menu suspenso limpo com:
  - **Meu Perfil** (abre a seção de tela inteira com dados cadastrais, chave PIX, CPF, departamento e preferências).
  - **Gerador de Palpites** (atalho rápido).
  - **Meus Investimentos (Limite de Jogo Responsável)**.
  - **Sair da Conta**.
- **Grade 3x3 Atualizada no Meu Espaço**:
  1. **Gerador de Palpites** (novo card principal no lugar de Meu Perfil)
  2. **Meus Grupos**
  3. **Meus Bolões (por Ano)**
  4. **Meus Palpites** (também com botão direto para abrir o Gerador)
  5. **Minhas Cotas**
  6. **Dezenas Favoritas**
  7. **Jogos Favoritos**
  8. **Meus Investimentos**
  9. **Estatísticas e Participantes**
- **Seções de Tela Inteira**: Ao clicar em qualquer card ou item do menu do avatar, a tela principal faz a transição para a **seção dedicada em tela inteira**, sem fundo escuro ou modal, mantendo a estética oficial Habitação CAIXA (`#F7F9FC`, tipografia limpa, `tabular-nums`).
