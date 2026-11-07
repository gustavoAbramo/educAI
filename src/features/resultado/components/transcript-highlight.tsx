// Busca sem diferenciar maiusculas nem acentos ("aula" acha "Aúla").
// Dobra o texto caractere a caractere guardando a posicao original, para o
// destaque cair no trecho certo mesmo quando a dobra muda o tamanho.
function fold(text: string) {
  let folded = "";
  const origin: number[] = [];
  for (let index = 0; index < text.length; index += 1) {
    const piece = text[index].normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
    for (let offset = 0; offset < piece.length; offset += 1) {
      folded += piece[offset];
      origin.push(index);
    }
  }
  return { folded, origin };
}

export function foldQuery(query: string) {
  return fold(query.trim()).folded;
}

export function textMatches(text: string, foldedQuery: string) {
  return Boolean(foldedQuery) && fold(text).folded.includes(foldedQuery);
}

export function countMatches(text: string, foldedQuery: string) {
  if (!foldedQuery) return 0;
  return fold(text).folded.split(foldedQuery).length - 1;
}

export function TranscriptHighlight({ text, foldedQuery }: { text: string; foldedQuery: string }) {
  if (!foldedQuery) return <>{text}</>;

  const { folded, origin } = fold(text);
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  let from = folded.indexOf(foldedQuery);

  while (from !== -1) {
    const start = origin[from];
    const end = origin[from + foldedQuery.length - 1] + 1;
    if (start > cursor) parts.push(text.slice(cursor, start));
    parts.push(
      <mark
        key={start}
        className="rounded bg-amber-300/60 px-0.5 text-foreground dark:bg-amber-400/40"
      >
        {text.slice(start, end)}
      </mark>,
    );
    cursor = end;
    from = folded.indexOf(foldedQuery, from + foldedQuery.length);
  }
  if (cursor < text.length) parts.push(text.slice(cursor));

  return <>{parts}</>;
}
