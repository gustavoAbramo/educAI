const suspiciousEncodingPattern = /(?:Ã.|Â.|â€|â€™|â€œ|â€�|â€“|â€”|â€¦|�)/;

function suspiciousEncodingScore(value: string) {
  const matches = value.match(/(?:Ã.|Â.|â€.|â€™|â€œ|â€�|â€“|â€”|â€¦|�)/g);
  return matches?.length ?? 0;
}

function decodeLatin1Utf8(value: string) {
  const bytes = Uint8Array.from(value, (character) => character.charCodeAt(0) & 0xff);
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

function normalizeUnicodeArtifacts(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/[\u200b-\u200d\u2060]/g, "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-");
}

export function repairTextArtifacts(value: string) {
  const normalized = normalizeUnicodeArtifacts(value);
  if (!suspiciousEncodingPattern.test(normalized)) {
    return normalized;
  }

  const decoded = normalizeUnicodeArtifacts(decodeLatin1Utf8(normalized));
  return suspiciousEncodingScore(decoded) < suspiciousEncodingScore(normalized)
    ? decoded
    : normalized;
}
