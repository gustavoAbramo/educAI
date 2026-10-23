import type { SessionRecord } from "@/lib/voice-intelligence";
import { loadPersistedVoiceSessions, savePersistedVoiceSessions } from "./local-persistence";
import { serverEnv } from "./runtime-env";
import { getAppSettingsRuntimeValue } from "./settings-store";
import {
  isSupabasePersistenceConfigured,
  loadSupabaseVoiceSessions,
  saveSupabaseVoiceSessions,
} from "./supabase-persistence";

export type VoicePersistenceProvider = "local" | "supabase";

export function selectedVoicePersistenceProvider(): VoicePersistenceProvider {
  const provider =
    serverEnv("EDUCAI_PERSISTENCE_PROVIDER") ??
    getAppSettingsRuntimeValue("EDUCAI_PERSISTENCE_PROVIDER");
  return provider === "supabase" ? "supabase" : "local";
}

export function voicePersistenceStatus() {
  const provider = selectedVoicePersistenceProvider();
  return {
    provider,
    configured: provider === "local" || isSupabasePersistenceConfigured(),
  };
}

export async function loadVoiceSessionsFromPersistence() {
  if (selectedVoicePersistenceProvider() === "supabase") {
    return loadSupabaseVoiceSessions();
  }

  return loadPersistedVoiceSessions();
}

export async function saveVoiceSessionsToPersistence(records: SessionRecord[]) {
  if (selectedVoicePersistenceProvider() === "supabase") {
    await saveSupabaseVoiceSessions(records);
    return;
  }

  await savePersistedVoiceSessions(records);
}
