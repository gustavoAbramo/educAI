// Converte o Markdown do export em texto puro (.txt) e em uma pagina HTML
// simples para imprimir / salvar como PDF pelo proprio navegador.

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function inlineMarkdownToHtml(value: string) {
  return escapeHtml(value)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*(?!\s)(.+?)\*/g, "$1<em>$2</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

function stripInlineMarkdown(value: string) {
  return value
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/(^|[^*])\*(?!\s)(.+?)\*/g, "$1$2")
    .replace(/`([^`]+)`/g, "$1");
}

export function markdownToPlainText(markdown: string) {
  return markdown
    .split(/\r?\n/)
    .map((line) => {
      const heading = /^(#{1,6})\s+(.*)$/.exec(line);
      if (heading) {
        const text = stripInlineMarkdown(heading[2]).trim();
        return heading[1].length <= 2 ? `${text.toUpperCase()}` : text;
      }
      const bullet = /^(\s*)[-*]\s+(.*)$/.exec(line);
      if (bullet) return `${bullet[1]}• ${stripInlineMarkdown(bullet[2])}`;
      if (/^\s*>\s?/.test(line)) return stripInlineMarkdown(line.replace(/^\s*>\s?/, ""));
      if (/^\s*---+\s*$/.test(line)) return "";
      return stripInlineMarkdown(line);
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function markdownToHtmlDocument(title: string, markdown: string) {
  const body: string[] = [];
  let listDepth = 0;
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) body.push(`<p>${paragraph.map(inlineMarkdownToHtml).join("<br>")}</p>`);
    paragraph = [];
  };
  const closeLists = () => {
    while (listDepth > 0) {
      body.push("</ul>");
      listDepth -= 1;
    }
  };

  for (const line of markdown.split(/\r?\n/)) {
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    const bullet = /^(\s*)[-*]\s+(.*)$/.exec(line);

    if (heading) {
      flushParagraph();
      closeLists();
      const level = Math.min(heading[1].length, 4);
      body.push(`<h${level}>${inlineMarkdownToHtml(heading[2])}</h${level}>`);
    } else if (bullet) {
      flushParagraph();
      const depth = Math.min(3, Math.floor(bullet[1].length / 2) + 1);
      while (listDepth < depth) {
        body.push("<ul>");
        listDepth += 1;
      }
      while (listDepth > depth) {
        body.push("</ul>");
        listDepth -= 1;
      }
      body.push(`<li>${inlineMarkdownToHtml(bullet[2])}</li>`);
    } else if (!line.trim() || /^\s*---+\s*$/.test(line)) {
      flushParagraph();
      closeLists();
    } else {
      closeLists();
      paragraph.push(line.replace(/^\s*>\s?/, ""));
    }
  }
  flushParagraph();
  closeLists();

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
  @page { margin: 18mm; }
  body { font: 11pt/1.55 system-ui, -apple-system, "Segoe UI", sans-serif; color: #1a1a1a; margin: 0; }
  h1 { font-size: 20pt; margin: 0 0 8pt; }
  h2 { font-size: 14pt; margin: 18pt 0 6pt; border-bottom: 1px solid #ddd; padding-bottom: 3pt; }
  h3 { font-size: 12pt; margin: 12pt 0 4pt; }
  h4 { font-size: 11pt; margin: 10pt 0 4pt; }
  p { margin: 0 0 8pt; }
  ul { margin: 0 0 8pt; padding-left: 18pt; }
  li { margin: 2pt 0; }
  code { font-family: ui-monospace, monospace; font-size: 10pt; }
  h2, h3 { break-after: avoid; }
  li, p { break-inside: avoid; }
</style>
</head>
<body>
${body.join("\n")}
</body>
</html>`;
}

export function downloadTextFile(fileName: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Abre a caixa de impressao do navegador com o documento; ali da para
// escolher "Salvar como PDF". Usa um iframe escondido para nao abrir aba nova.
export function printHtmlDocument(html: string) {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.position = "fixed";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  frame.style.right = "0";
  frame.style.bottom = "0";
  document.body.appendChild(frame);

  const cleanup = () => window.setTimeout(() => frame.remove(), 500);
  frame.onload = () => {
    const view = frame.contentWindow;
    if (!view) return cleanup();
    view.addEventListener("afterprint", cleanup, { once: true });
    view.focus();
    view.print();
    // Alguns navegadores nao disparam afterprint; garante a limpeza.
    window.setTimeout(cleanup, 60_000);
  };
  frame.srcdoc = html;
}
