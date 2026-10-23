import type {
  TranscriptionProviderMode,
  VoiceRecording,
  VoiceSession,
  VoiceTranscript,
} from "@/lib/voice-intelligence";
import { transcribeRecordingWithFasterWhisper } from "./faster-whisper-provider";
import { transcribeRecordingWithGemini } from "./gemini-provider";
import { transcribeRecordingWithOpenAI } from "./openai-provider";
import {
  providerDiagnosticsEnabled,
  providerHasGeminiKey,
  providerHasOpenAIKey,
  resolveTranscriptionProvider,
  simulatedProvidersEnabled,
} from "./provider-runtime";

export type { TranscriptionProviderMode } from "@/lib/voice-intelligence";

export type MockTranscriber = (
  session: VoiceSession,
  recording?: VoiceRecording,
) => VoiceTranscript;

function logProviderSelection(provider: TranscriptionProviderMode) {
  if (!providerDiagnosticsEnabled()) return;
  console.info(
    [
      "[educAI] transcription",
      `provider=${provider}`,
      `openaiKey=${providerHasOpenAIKey()}`,
      `geminiKey=${providerHasGeminiKey()}`,
    ].join(" "),
  );
}

export { resolveTranscriptionProvider } from "./provider-runtime";

export async function transcribeWithConfiguredProvider(
  session: VoiceSession,
  recording: VoiceRecording | undefined,
  mockTranscriber: MockTranscriber,
): Promise<VoiceTranscript> {
  const provider = resolveTranscriptionProvider();
  logProviderSelection(provider);

  if (provider === "mock") {
    if (!simulatedProvidersEnabled()) {
      throw new Error(
        "Simulated transcription is disabled in this environment. Configure OpenAI, Gemini, or Faster-Whisper before processing this session.",
      );
    }
    return mockTranscriber(session, recording);
  }

  if (provider === "faster-whisper") {
    const transcript = await transcribeRecordingWithFasterWhisper(session, recording);
    if (!transcript) {
      throw new Error(
        "Faster-Whisper transcription is unavailable because the local worker did not return a readable transcript.",
      );
    }

    return transcript;
  }

  if (provider === "openai") {
    if (!providerHasOpenAIKey()) {
      throw new Error(
        "OpenAI transcription is unavailable because OPENAI_API_KEY is not configured. Configure the backend key or switch the transcription provider to Gemini or Faster-Whisper.",
      );
    }

    const transcript = await transcribeRecordingWithOpenAI(session, recording);
    if (!transcript) {
      throw new Error(
        "OpenAI transcription is unavailable because no readable audio file was found.",
      );
    }

    return transcript;
  }

  if (!providerHasGeminiKey()) {
    throw new Error(
      "Gemini transcription is unavailable because GEMINI_API_KEY is not configured. Configure the backend key or switch the transcription provider to OpenAI or Faster-Whisper.",
    );
  }

  const transcript = await transcribeRecordingWithGemini(session, recording);
  if (!transcript) {
    throw new Error(
      "Gemini transcription is unavailable because no readable audio file was found.",
    );
  }

  return transcript;
}
