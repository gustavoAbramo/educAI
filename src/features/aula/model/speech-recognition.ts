import type { SpeechRecognitionAlternativeLike, SpeechRecognitionResultLike } from "@/lib/speech";
import { normalizeTechnicalTerms, scoreTechnicalTerms } from "@/lib/technical-terms";

export function readableSpeechRecognitionError(error?: string) {
  if (error === "not-allowed" || error === "service-not-allowed") {
    return "Permissao de microfone ou transcricao ao vivo bloqueada no navegador.";
  }

  if (error === "network") {
    return "Transcricao ao vivo indisponivel por falha de rede do navegador.";
  }

  if (error === "audio-capture") {
    return "Nao foi possivel capturar audio para transcricao ao vivo.";
  }

  return "Transcricao ao vivo indisponivel neste momento.";
}

export function liveSegmentId() {
  return `live_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function cleanLiveSpeechText(text: string) {
  const cleaned = text
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();

  if (!cleaned) return "";
  const withTechnicalTerms = normalizeTechnicalTerms(cleaned);
  return withTechnicalTerms.charAt(0).toLocaleUpperCase("pt-BR") + withTechnicalTerms.slice(1);
}

export function bestSpeechAlternative(result: SpeechRecognitionResultLike) {
  const alternatives = Array.from({ length: Math.max(1, result.length ?? 1) })
    .map((_, index) => result[index])
    .filter((item): item is SpeechRecognitionAlternativeLike => Boolean(item?.transcript?.trim()));

  if (!alternatives.length) return undefined;

  const scored = alternatives.map((alternative) => {
    const confidence = alternative.confidence ?? 0;
    const termHits = scoreTechnicalTerms(alternative.transcript);
    const lengthScore = Math.min(alternative.transcript.length / 80, 1);
    const score = confidence * 1.6 + termHits * 0.35 + lengthScore * 0.1;

    return {
      alternative,
      score,
      confidence,
      length: alternative.transcript.length,
    };
  });

  return scored.sort(
    (a, b) => b.score - a.score || b.confidence - a.confidence || b.length - a.length,
  )[0]?.alternative;
}
