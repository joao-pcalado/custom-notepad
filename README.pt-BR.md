<div align="center">

# ✦ Bloco Custom

**Um editor de texto rico em recursos e totalmente personalizável — construído inteiramente com HTML, CSS e JavaScript puro. Sem frameworks, sem dependências.**

[![HTML](https://img.shields.io/badge/HTML5-E34F26?style=flat-square&logo=html5&logoColor=white)](https://developer.mozilla.org/pt-BR/docs/Web/HTML)
[![CSS](https://img.shields.io/badge/CSS3-1572B6?style=flat-square&logo=css3&logoColor=white)](https://developer.mozilla.org/pt-BR/docs/Web/CSS)
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black)](https://developer.mozilla.org/pt-BR/docs/Web/JavaScript)
[![Licença](https://img.shields.io/badge/Licen%C3%A7a-MIT-green?style=flat-square)](LICENSE)
[![Sem Dependências](https://img.shields.io/badge/Depend%C3%AAncias-Nenhuma-blueviolet?style=flat-square)](#)

> 🇺🇸 [Read in English](README.md)

</div>

---

## Visão Geral

O **Bloco Custom** nasceu de uma necessidade pessoal: substituir o Bloco de Notas do Windows por algo mais agradável e flexível. O que começou como um arquivo HTML simples evoluiu para um editor de texto completo no estilo desktop, empacotável como executável nativo.

A aplicação inteira são **três arquivos** sem dependências externas em tempo de execução — uma demonstração do que é possível alcançar com os padrões web puros.

---

## Estrutura do Projeto

```
bloco-custom/
├── index.html      — Marcação: toda a estrutura e layout da interface
├── style.css       — Estilos: temas, componentes, CSS custom properties
├── main.js         — Lógica: editor, abas, minimap, arquivos, chips de link
├── README.md
└── README.pt-BR.md
```

---

## Funcionalidades

### Editor Principal
- **`contenteditable` div** como superfície de edição — permite nós HTML reais inline (usado para os chips de link)
- **Números de linha** sincronizados com o scroll, com destaque na linha atual — estilo VS Code
- **Tecla Tab** insere 4 espaços (sem armadilha de foco)
- **Quebra de linha** configurável
- **Verificação ortográfica** configurável
- **Contagem de palavras, caracteres, linha e coluna** em tempo real na barra de status

### Sistema de Abas
- **Múltiplas abas** — abra quantos arquivos precisar simultaneamente
- **Reordenação por arrastar e soltar** entre abas
- **Indicador de alterações não salvas** (●) por aba
- Atalhos: `Ctrl+T` nova aba, `Ctrl+W` fechar, `Ctrl+Tab` navegar

### Minimap
- **Minimap estilo VS Code** renderizado em `<canvas>` HTML5 na borda direita
- Clicável e arrastável — clique em qualquer ponto para pular àquela posição no documento
- Indicador de viewport mostra a região atualmente visível
- Linha atual destacada no minimap
- Linhas de comentário e títulos renderizados em cores distintas
- Ativar/desativar com `Ctrl+Shift+P`

### Chips de Link
- **Preview de link inline** opcional — quando ativado, URLs brutas são substituídas por chips estilizados diretamente no editor
- Cada chip exibe o **favicon do site**, **título da página** (obtido de forma assíncrona) e o **domínio**
- Construído com nós `contentEditable="false"` — os chips se comportam como caracteres atômicos (selecionáveis e deletáveis)
- Títulos obtidos via proxy CORS com fallback gracioso para o domínio
- Passar o mouse sobre um chip revela a URL completa em um tooltip
- Ativar/desativar no painel de Configurações

### Operações com Arquivos
- **Abrir** — lê `.txt`, `.md`, `.log`, `.json`, `.html`, `.js`, `.css`, `.py`, `.ts`, `.sh`, `.yaml` e outros
- **Salvar / Salvar como** — faz download do arquivo com o nome correto
- **Auto-save** — opcional, dispara 5 segundos após o último pressionamento de tecla
- **Arquivos recentes** — dropdown registra os últimos 10 arquivos abertos

### Buscar e Substituir
- **Busca com contagem de resultados em tempo real** (`Ctrl+F`)
- Navegação entre resultados com `↑` / `↓` ou `Enter` / `Shift+Enter`
- **Substituir** individual ou **Substituir tudo**
- Opções de diferenciação de maiúsculas e palavra inteira

### Personalização
- **9 temas integrados**: Noite Azul, Floresta, Carvão, Lavanda, Papel, Neve, Terminal, Oceano, Róseo
- **Seletores de cor personalizados** para fundo, texto e cor de destaque
- **5 famílias de fonte**: JetBrains Mono, Courier New, Inter, Georgia, Sistema
- **Slider de tamanho de fonte** (11–28px)
- **Slider de espaçamento entre linhas**
- Todas as preferências aplicadas instantaneamente via CSS custom properties

### Modo Foco
- `F11` entra no **modo sem distração** — as barras de UI somem, reaparecem ao passar o mouse
- Coluna do editor limitada a 760px para escrita confortável de textos longos

---

## Atalhos de Teclado

| Atalho | Ação |
|---|---|
| `Ctrl+S` | Salvar |
| `Ctrl+Shift+S` | Salvar como |
| `Ctrl+O` | Abrir arquivo |
| `Ctrl+N` | Nova aba |
| `Ctrl+T` | Nova aba |
| `Ctrl+W` | Fechar aba atual |
| `Ctrl+Tab` | Próxima aba |
| `Ctrl+Shift+Tab` | Aba anterior |
| `Ctrl+F` | Buscar e Substituir |
| `Ctrl+Shift+P` | Alternar Minimap |
| `Ctrl+,` | Abrir Configurações |
| `F11` | Alternar Modo Foco |

---

## Como Usar

### Rodar no Navegador

```bash
# Clone o repositório
git clone https://github.com/seu-usuario/bloco-custom.git
cd bloco-custom
```

Como o `index.html` carrega `main.js` e `style.css` como arquivos separados, ele precisa ser servido localmente. Use o **Live Server** do VS Code, ou rode:

```bash
npx serve .
# → Disponível em http://localhost:3000
```

---

## Empacotar como App Desktop

### Opção 1 — Nativefier (rápido, baseado em Electron, ~230MB)

Empacota o app com um runtime Chromium completo. Mais fácil de configurar.

```bash
# Instale o Nativefier globalmente
npm install -g nativefier

# Sirva o projeto localmente
npx serve .
# → Rodando em http://localhost:3000

# Gere o executável
nativefier --name "Bloco Custom" --out ~/Desktop "http://localhost:3000"
```

Gera um `.exe` (Windows), `.app` (macOS) ou binário (Linux).
O resultado tem ~230MB pois inclui o Chromium completo.

---

### Opção 2 — Tauri (recomendado, WebView nativa, ~8MB)

O [Tauri](https://tauri.app/) usa a **WebView nativa do sistema operacional** (WebKit no macOS/Linux, WebView2 no Windows) em vez de empacotar o Chromium — gerando binários abaixo de 10MB.

#### Pré-requisitos

```bash
# Instale o Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Instale o Node.js (se ainda não tiver)
# https://nodejs.org

# Instale o Tauri CLI
npm install -g @tauri-apps/cli
```

> No Linux, instale também as dependências do sistema listadas em [tauri.app/v1/guides/getting-started/prerequisites](https://tauri.app/v1/guides/getting-started/prerequisites/#setting-up-linux).

#### Configuração

```bash
cd bloco-custom

# Inicialize o Tauri no projeto
npm create tauri-app@latest -- --template vanilla
```

Quando solicitado, aponte a **pasta do frontend** para `.` (raiz do projeto) e a **URL do servidor de desenvolvimento** para `http://localhost:3000`.

Sirva o projeto durante o desenvolvimento:

```bash
npx serve .
```

E em outro terminal, rode o Tauri:

```bash
npx tauri dev      # desenvolvimento (hot reload)
npx tauri build    # binário de produção → src-tauri/target/release/
```

O binário final ficará em `src-tauri/target/release/` — tipicamente **5–10MB**, sem Chromium.

---

## Arquitetura

```
index.html   — Shell: importação de fontes, link do CSS, estrutura HTML, tag do script
style.css    — Todos os estilos usando CSS custom properties para temas em tempo real
main.js      — Lógica completa da aplicação (~600 linhas de JS puro)
    ├── Motor de abas     Gerenciamento de estado contenteditable por aba
    ├── Gutter            Renderização de números de linha sincronizada com scroll
    ├── Minimap           Visão geral em canvas com navegação por clique/arraste
    ├── Chips de link     Conversão inline de URL → chip com busca assíncrona de títulos
    ├── Busca/Substituição Busca em regex com navegação entre resultados
    ├── I/O de arquivos   FileReader API para abrir, Blob URL para salvar
    ├── Motor de temas    Injeção de CSS custom properties
    └── Auto-save         Save com debounce via setTimeout
```

### Decisões Técnicas

**`contenteditable` em vez de `<textarea>`**
Textarea renderiza apenas texto puro. O recurso de chips exige nós DOM reais inline com o texto, só possível com `contenteditable`. Uma função `getEditorText()` percorre a árvore DOM para extrair o texto puro (incluindo URLs dos chips) para salvar e calcular estatísticas.

**Canvas para o minimap**
O minimap renderiza o texto em ~18% do tamanho em um `<canvas>`, redesenhando a cada input com debounce via `requestAnimationFrame`. Eventos de clique e arraste mapeiam para proporções de scroll, tornando-o independente de resolução.

**CSS custom properties para temas**
Todas as cores são variáveis CSS em `:root`. Troca de tema e seletores de cor chamam `root.style.setProperty()` — sem alternância de classes, atualização instantânea.

**Proxy CORS para metadados de links**
Buscar títulos de URLs arbitrárias é bloqueado pelo CORS. O app usa o proxy público `allorigins.win` para obter o HTML bruto e extrai `<title>` e `og:title` via regex. Resultados em cache na memória.

---

## Capturas de Tela

> _Adicione capturas de tela aqui mostrando diferentes temas, o minimap, os chips de link e o modo foco._

---

## Próximos Passos

- [ ] Syntax highlighting de Markdown no editor
- [ ] Persistência de sessão via `localStorage`
- [ ] Visualização em painel dividido (dois editores lado a lado)
- [ ] Exportação e importação de temas personalizados em JSON
- [ ] Pipeline de build com Tauri e auto-updater

---

## Licença

MIT © [João P. Calado](https://github.com/joao-pcalado)

---

<div align="center">

Construído com curiosidade e zero frameworks.

</div>
