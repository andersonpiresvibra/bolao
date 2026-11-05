# Guia Oficial de Design para IA — Padrão Visual CAIXA (Conforto, Simplicidade e Harmonia)

> **INSTRUÇÃO OBRIGATÓRIA PARA A IA**: Sempre que criar, editar ou estilizar qualquer tela, modal, card, botão, formulário ou componente neste projeto, consulte e siga rigorosamente as diretrizes deste documento. O objetivo visual é transmitir **conforto, tranquilidade, leveza, organização e confiança institucional**, inspirado diretamente no aplicativo **Habitação CAIXA**.

---

## 1. Princípios Fundamentais de Layout

1. **Formato Exclusivo Mobile (`max-w-[430px]`)**:
   - Toda a aplicação roda centralizada em um container mobile de `max-w-[430px]` com fundo principal claro e acetinado (`#F7F9FC`).
2. **Zero "Box Dentro de Box"**:
   - **Proibido** aninhar caixas com bordas dentro de outras caixas com bordas.
   - Dados de resumo (como valores, prazos, taxas e totais) devem ser exibidos em **linhas limpas Chave ↔ Valor** (rótulo à esquerda em `#5F6C7B` e valor à direita em `#333E48`), separadas apenas por respiro vertical (`space-y-2.5`).
3. **Elevação por Sombra Concentrada (Sem Bordas Escuras e Sem Blur Espalhado)**:
   - Os cards **não usam bordas cinza-escuras ou pretas** e **não usam blur espalhado**. Eles se destacam do fundo `#F7F9FC` através do fundo branco puro (`#FFFFFF`) combinado com uma sombra curta e concentrada próxima às bordas inferiores do card:
     ```css
     box-shadow: 0 2px 5px -1px rgba(0, 45, 90, 0.14), 0 1px 2px 0 rgba(0, 45, 90, 0.09);
     border: 1px solid #E6EDF5;
     border-radius: 4px;
     ```
4. **Cantos Discretos (`4px` máx)**:
   - Respeitando a regra do projeto, o arredondamento máximo permitido é `rounded-[4px]` (`4px`) nos cards e `rounded-none` / `rounded-[2px]` em botões de barra.

---

## 2. Paleta de Cores Oficial

| Elemento | Cor Hex | Uso na Interface |
| :--- | :--- | :--- |
| **Gradiente Cabeçalho CAIXA** | `linear-gradient(115deg, #005CA9 0%, #0E7BB3 52%, #38B29A 100%)` | Topo principal com saudação `"Olá, NOME"`, relógio e título da tela |
| **Azul CAIXA Principal** | `#005CA9` | Títulos de ação nos cards, links `"Mostrar todos >"`, ícones principais e aba ativa no rodapé |
| **Turquesa / Verde CAIXA** | `#2B9E9B` / `#008B47` | Destaques positivos, confirmações de Pix conciliado e indicadores de sucesso |
| **Halo Azul-Claríssimo (Ícones)** | `#EBF4FC` | Círculo suave de fundo (`w-10 h-10 rounded-full`) para ícones dentro dos cards de serviços |
| **Fundo da Página (Canvas Mobile)** | `#F7F9FC` | Fundo geral da tela onde os cards brancos flutuam |
| **Fundo do Card** | `#FFFFFF` | Superfície limpa de todos os cards e modais |
| **Texto Principal (Títulos)** | `#333E48` | Cinza-chumbo suave (nunca usar preto puro `#000000`) |
| **Texto Secundário (Rótulos)** | `#5F6C7B` | Descrições, endereços, subtítulos e chaves de listas |
| **Divisória Sutil** | `#EEF2F6` | Linha fina quase imperceptível quando necessário separar seções |

---

## 3. Anatomia dos Componentes-Padrão

### 3.1. Cabeçalho Superior (Estilo `"Olá, ANDERSON"`)
- Fundo com a classe `.caixa-header-gradient`.
- Saudação limpa: `"Olá,"` em `12px` branco translúcido (`text-white/90`) e o primeiro nome do usuário em **CAIXA ALTA NEGRITO (`18px`)** logo abaixo.
- À direita: Relógio digital discreto (data + hora em tempo real), ícone/marca CAIXA e ação rápida de perfil/saída.

### 3.2. Cabeçalho de Seção (`Título` + `Link >`)
- Alinhado fora do card, diretamente sobre o fundo `#F7F9FC`:
  - Esquerda: Título em `#333E48`, `font-bold`, `15px` (ex: `Meus bolões`, `Pagamentos`, `Serviços`).
  - Direita: Link de ação em `#005CA9`, `font-bold`, `12px` acompanhado de seta `>` (ex: `Mostrar todos >`, `Cadastrar empresa >`).

### 3.3. Card Principal de Destaque (Estilo `"Meus contratos"` / `"Resumo"`)
- Fundo `#FFFFFF`, classe `.caixa-card`, padding `16px` (`p-4`).
- Título em `#333E48` (`font-bold text-sm`), descrição em `#5F6C7B` (`text-xs leading-relaxed`).
- Linhas de resumo financeiro alinhadas extremidade a extremidade (`flex justify-between items-center text-xs`).
- Rodapé do card alinhado à direita com link em `#005CA9` + ícone `ChevronRight` (`Mais informações >` ou `Acessar bolão >`).

### 3.4. Grid de Cards de Ação (2 Colunas ou 3 Colunas — Estilo `"Pagamentos / Serviços"`)
- Grid com espaçamento confortável (`grid-cols-2 gap-3` ou `grid-cols-3 gap-2.5`).
- Cada card usa `.caixa-card p-3.5 flex flex-col items-center justify-center text-center gap-2`:
  - No topo: Círculo `.caixa-icon-halo` (`w-10 h-10 rounded-full bg-[#EBF4FC] flex items-center justify-center text-[#005CA9]`).
  - Na base: Rótulo centralizado em `#005CA9` (`font-bold text-xs leading-snug`).

### 3.5. Janelas Modais (`Tela Modal`)
- Overlay suave com desfoque leve (`bg-[#1E293B]/55 backdrop-blur-[1px]`).
- Card modal branco flutuante (`bg-white rounded-[4px] shadow-xl border border-[#E2E8F0]`), cabeçalho com `.caixa-header-gradient`, campos de formulário com fundo `#F8FAFC` e borda suave `#CBD5E1` que muda para `#005CA9` no foco.

### 3.6. Rodapé de Navegação (Menu Inferior)
- Barra fixa na base (`max-w-[430px]`) com fundo `#FFFFFF` puro e sombra superior suave (`.caixa-footer-shadow`), sem linhas verticais escuras.
- 4 botões limpos: o botão ativo exibe ícone e texto em `#005CA9` (`font-bold`), e os inativos em `#5F6C7B` (`font-medium`).
