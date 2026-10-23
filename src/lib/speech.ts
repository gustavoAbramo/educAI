// Helpers compartilhados de voz no navegador (Web Speech API).
// Reune os tipos de SpeechRecognition (ditado) e os utilitarios de
// SpeechSynthesis (fala), usados pela aula ao vivo e pelo input do assistente.

export type SpeechRecognitionAlternativeLike = {
  transcript: string;
  confidence?: number;
};

export type SpeechRecognitionResultLike = {
  isFinal: boolean;
  length?: number;
  [index: number]: SpeechRecognitionAlternativeLike | undefined;
};

export type SpeechRecognitionResultListLike = {
  length: number;
  [index: number]: SpeechRecognitionResultLike | undefined;
};

export type SpeechRecognitionEventLike = Event & {
  resultIndex: number;
  results: SpeechRecognitionResultListLike;
};

export type SpeechRecognitionErrorEventLike = Event & {
  error?: string;
};

export type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives?: number;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  abort: () => void;
  start: () => void;
  stop: () => void;
};

export type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

/** Retorna o construtor de SpeechRecognition do navegador, se houver. */
export function getSpeechRecognition(): SpeechRecognitionConstructor | undefined {
  if (typeof window === "undefined") return undefined;
  const speechWindow = window as Window &
    typeof globalThis & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };

  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
}

/** Indica se a sintese de voz (TTS) esta disponivel neste navegador. */
export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== "undefined" && Boolean(window.speechSynthesis);
}

type SpeakOptions = {
  lang?: string;
  rate?: number;
  pitch?: number;
  onStart?: () => void;
  onEnd?: () => void;
};

/**
 * Fala um texto em voz alta. Cancela qualquer fala anterior antes de comecar.
 * Retorna true se conseguiu iniciar a sintese de voz.
 */
export function speak(text: string, options: SpeakOptions = {}): boolean {
  if (!isSpeechSynthesisSupported()) return false;

  const content = text.trim();
  if (!content) return false;

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(content);
  utterance.lang = options.lang ?? "pt-BR";
  utterance.rate = options.rate ?? 1;
  utterance.pitch = options.pitch ?? 1;
  if (options.onStart) utterance.onstart = options.onStart;
  if (options.onEnd) {
    utterance.onend = options.onEnd;
    utterance.onerror = options.onEnd;
  }

  window.speechSynthesis.speak(utterance);
  return true;
}

/** Interrompe imediatamente qualquer fala em andamento. */
export function cancelSpeak(): void {
  if (!isSpeechSynthesisSupported()) return;
  window.speechSynthesis.cancel();
}

/**
 * Converte o markdown leve das respostas do assistente em texto corrido,
 * para a leitura em voz alta nao soletrar marcadores como "-", ">" ou "#".
 */
export function toSpeech(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^\s*>\s?/gm, "")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_`#>]/g, "")
    .replace(/\n{2,}/g, ". ")
    .replace(/\n/g, ". ")
    .replace(/\.\s*\.\s*/g, ". ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function normalizeAssistantSpeech(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

const handsFreeAssistantPatterns = [
  /^(?:me\s+ajuda(?:\s+com\s+isso)?|me\s+ajude)\b/i,
  /^(?:resume|resuma|resumir|sumariza|sumarize)\b/i,
  /^(?:explica|explique|simplifica|simplifique)\b/i,
  /^(?:o\s+que\s+eu\s+respondo|como\s+eu\s+respondo|gera\s+uma\s+resposta|monte\s+uma\s+resposta)\b/i,
  /^(?:qual\s+(?:o\s+)?proximo\s+passo|quais\s+os\s+proximos\s+passos|qual\s+o\s+follow\s*up|qual\s+o\s+follow-up)\b/i,
  /^(?:o\s+que\s+eu\s+perdi|o\s+que\s+passou|que\s+pergunta\s+eu\s+faco|que\s+pergunta\s+eu\s+poderia\s+fazer)\b/i,
  /^(?:gera\s+um\s+resumo\s+executivo|faz\s+um\s+resumo\s+executivo|resumo\s+executivo)\b/i,
];

/**
 * Detecta a palavra de ativacao "assistente" no inicio de uma fala e devolve
 * a pergunta que vem depois. Tambem aceita comandos naturais curtos quando
 * o usuario esta em modo hands-free do assistente.
 */
export function matchWakeWord(text: string): string | null {
  const normalized = normalizeAssistantSpeech(text);
  if (!normalized) return null;

  const explicit = normalized.match(
    /^\s*(?:ei|oi|ok|ola|olá|hey)?[,!\s]*(?:educai\s+)?assistente[\s,:.!?-]+(.+)$/i,
  );
  if (explicit) {
    const question = normalizeAssistantSpeech(explicit[1]);
    return question.length >= 2 ? question : null;
  }

  const shortEnough = normalized.length <= 140;
  const soundsLikeCommand = handsFreeAssistantPatterns.some((pattern) => pattern.test(normalized));
  if (shortEnough && soundsLikeCommand) {
    return normalized;
  }

  return null;
}
