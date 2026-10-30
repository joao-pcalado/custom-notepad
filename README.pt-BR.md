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

A aplicação inteira são **quatro arquivos** sem dependências externas em tempo de execução — uma demonstração do que é possível alcançar com os padrões web puros.

---

## Estrutura do Projeto

```
bloco-custom/
├── index.html      — Marcação: toda a estrutura e layout da interface
├── style.css       — Estilos: temas, componentes, CSS custom properties
├── utils.js        — Funções puras (busca, URLs, contagem…) usadas também pelos testes
├── main.js         — Lógica: editor, abas, minimap, arquivos, chips de link, sessão
├── manifest.webmanifest — Torna o app instalável e o registra para abrir .txt, .md…
├── sw.js           — Service worker: o app instalado funciona offline
├── icons/          — Ícones do app
├── tests/          — Testes no navegador, sem dependências (unitários + integração)
├── README.md
└── README.pt-BR.md
```

---

## Funcionalidades

### Editor Principal
- **`contenteditable` div** como superfície de edição — permite nós HTML reais inline (usado para os chips de link)
- **Números de linha** sincronizados com o scroll, com destaque na linha atual — estilo VS Code
- **Tecla Tab** insere 4 espaços, `Shift+Tab` remove; `Enter` mantém a indentação da linha
- **Colar é sempre texto puro** — formatação de páginas ou do Word não entra na nota
- **Quebra de linha** configurável (`Alt+Z`)
- **Verificação ortográfica** configurável
- **Contagem de palavras, caracteres, linha, coluna e seleção** em tempo real na barra de status, além do fim de linha do arquivo (LF/CRLF)

### Sistema de Abas
- **Múltiplas abas** — abra quantos arquivos precisar simultaneamente
- **Reordenação por arrastar e soltar**; **duplo clique para renomear**, clique do meio para fechar
- **Indicador de alterações não salvas** (●) por aba e no título da janela
- **Sessão restaurada** — as abas abertas (e o texto não salvo) voltam ao reabrir o app
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
- Títulos obtidos via proxy CORS com fallback gracioso para o domínio (o link é enviado ao `allorigins.win`)
- Uma URL ainda sendo digitada continua como texto; vira chip quando o cursor sai dela
- Passar o mouse sobre um chip revela a URL completa em um tooltip; copiar copia a URL
- Ativar/desativar no painel de Configurações

### Operações com Arquivos
- **Abrir** — lê `.txt`, `.md`, `.log`, `.json`, `.html`, `.js`, `.css`, `.py`, `.ts`, `.sh`, `.yaml` e outros, ou **arraste arquivos para a janela**
- **Salvar** — no Chrome/Edge (File System Access API) grava **no próprio arquivo** do disco; nos outros navegadores faz download
- **Fim de linha preservado** — arquivos CRLF continuam CRLF ao salvar
- **Arquivos recentes** — dropdown guarda os últimos 10 arquivos *com o conteúdo*, para reabrir depois

### Buscar e Substituir
- **Busca com contagem em tempo real** (`Ctrl+F`), com todos os resultados destacados no texto
- Navegação entre resultados com `↑` / `↓` ou `Enter` / `Shift+Enter`
- **Substituir** (`Enter` no campo) ou **Substituir tudo** (`Ctrl+Enter`) — ambos podem ser desfeitos com `Ctrl+Z`
- Opções de diferenciação de maiúsculas e palavra inteira (que entende acentos)
- O texto de substituição é literal — `$&` ou `$1` não são interpretados

### Personalização
- **9 temas integrados**: Noite Azul, Floresta, Carvão, Lavanda, Papel, Neve, Terminal, Oceano, Róseo
- **Seletores de cor personalizados** para fundo, texto e cor de destaque
- **5 famílias de fonte**: JetBrains Mono, Courier New, Inter, Georgia, Sistema
- **Slider de tamanho de fonte** (11–28px)
- **Slider de espaçamento entre linhas**
- Todas as preferências aplicadas instantaneamente via CSS custom properties e **lembradas** entre sessões

### Modo Foco
- `F11` entra no **modo sem distração** — as barras de UI somem e reaparecem ao passar o mouse sobre elas
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
| `Ctrl+F` | Buscar |
| `Ctrl+H` | Buscar e Substituir |
| `Ctrl+Shift+P` | Alternar Minimap |
| `Ctrl+,` | Abrir Configurações |
| `Alt+Z` | Alternar quebra de linha |
| `F11` | Alternar Modo Foco |

> Numa aba comum do navegador, `Ctrl+N`, `Ctrl+T`, `Ctrl+W` e `Ctrl+Tab` são reservados pelo próprio navegador. Eles funcionam quando o app roda empacotado como desktop (veja abaixo).

---

## Como Usar

### Usar como bloco de notas do Windows

O Bloco é um app instalável (PWA). Instalado, ele ganha janela e ícone próprios, funciona offline e aparece no **"Abrir com"** do Windows para `.txt`, `.md`, `.log`, `.json`, `.csv` e outros.

1. Abra **https://joao-pcalado.github.io/custom-notepad/** no **Edge**, **Chrome** ou **Brave**.
2. Clique em **⬇ Instalar app**, na barra do Bloco (ou no ícone de instalar da barra de endereço).
3. Clique com o botão direito num `.txt` → **Abrir com** → **Escolher outro aplicativo** → **Bloco** → **Sempre**.
   (Ou: Configurações do Windows → Aplicativos → Aplicativos padrão → `.txt` → Bloco.)
4. Na primeira vez, o navegador pergunta se o Bloco pode abrir esses arquivos — permita.

Arquivos abertos assim entram como abas na mesma janela, e o `Ctrl+S` grava direto no arquivo, inclusive depois de fechar e reabrir o app.

### Rodar no Navegador

```bash
# Clone o repositório
git clone https://github.com/joao-pcalado/custom-notepad.git
cd custom-notepad

# Sirva a pasta (qualquer servidor estático serve)
npx serve .
# → Disponível em http://localhost:3000
```

Abrir o `index.html` direto também funciona para editar, mas um servidor local é o recomendado (o **Live Server** do VS Code também serve).

### Rodar os Testes

Os testes não têm dependências — rodam no próprio navegador. Com o projeto servido (acima), abra:

```
http://localhost:3000/tests/
```

A página roda testes unitários do `utils.js` e testes de integração que carregam o app real num iframe (digitação, abas, buscar/substituir, arquivos, sessão, chips de link). Adicione `?grep=texto` na URL para rodar só os testes que batem com o filtro. O resultado também fica em `window.__testResults`, para automação.

Os testes abrem o app no modo `?test`, que usa chaves de armazenamento separadas e não acessa a rede — suas notas reais nunca são tocadas.

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
cd custom-notepad

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
index.html   — Shell: importação de fontes, link do CSS, estrutura HTML, tags de script
style.css    — Todos os estilos usando CSS custom properties para temas em tempo real
utils.js     — Funções puras (sem estado do editor), cobertas por testes unitários
main.js      — Lógica completa da aplicação (JS puro)
    ├── Modelo do editor  DOM ⇄ texto puro e offsets de texto ⇄ posições no DOM
    ├── Motor de abas     Conteúdo, cursor, scroll e arquivo de cada aba
    ├── Gutter            Renderização de números de linha sincronizada com scroll
    ├── Minimap           Visão geral em canvas com navegação por clique/arraste
    ├── Chips de link     Conversão inline de URL → chip com busca assíncrona de títulos
    ├── Busca/Substituição Regex, CSS Custom Highlight API, substituição que pode ser desfeita
    ├── I/O de arquivos   File System Access API, com download como alternativa
    ├── Sessão            Abas e preferências guardadas no localStorage
    └── Motor de temas    Injeção de CSS custom properties
tests/       — Mini executor de testes + testes unitários e de integração
```

### Decisões Técnicas

**`contenteditable` em vez de `<textarea>`**
Textarea renderiza apenas texto puro. O recurso de chips exige nós DOM reais inline com o texto, só possível com `contenteditable`. Uma única função (`serializeEditor()`) percorre o DOM e gera o texto puro — URLs dos chips, `<br>` e `\n` como quebras, ignorando a quebra "sentinela" que o navegador adiciona para exibir uma última linha vazia — e converte posições do cursor em offsets de texto e vice-versa. As edições passam por `document.execCommand('insertText')` sempre que possível, para o desfazer nativo (`Ctrl+Z`) continuar funcionando.

**Canvas para o minimap**
O minimap renderiza o texto em ~18% do tamanho em um `<canvas>`, redesenhando a cada input com debounce via `requestAnimationFrame`. Eventos de clique e arraste mapeiam para proporções de scroll, tornando-o independente de resolução.

**CSS custom properties para temas**
Todas as cores são variáveis CSS em `:root`. Troca de tema e seletores de cor chamam `root.style.setProperty()` — sem alternância de classes, atualização instantânea.

**Proxy CORS para metadados de links**
Buscar títulos de URLs arbitrárias é bloqueado pelo CORS. O app usa o proxy público `allorigins.win` para obter o HTML bruto e lê `og:title` / `<title>` com `DOMParser` (que nunca executa os scripts da página). Resultados em cache na memória. Como cada link é enviado a um terceiro, o recurso vem desligado.

---

## Capturas de Tela

![Editor](image.png)
![Painel de configurações e temas](image-1.png)
![Chips de link](image-2.png)

---

## Próximos Passos

- [ ] Syntax highlighting de Markdown no editor
- [x] Persistência de sessão via `localStorage`
- [x] Números de linha alinhados com linhas quebradas
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
