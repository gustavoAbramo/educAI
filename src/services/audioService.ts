import type { AudioSource, SessionAudio } from "@/types/api";
import { apiClient } from "./apiClient";

type UploadOptions = {
    source: AudioSource;
    durationSeconds?: number;
    metadata?: Record<string, unknown>;
    fileName?: string;
    mimeType?: string;
};

export async function uploadSessionAudio(
    sessionId: string,
    blob: Blob,
    options: UploadOptions,
) {
    const formData = new FormData();
    const fileName = options.fileName ?? `recording-${Date.now()}.webm`;
    const mimeType = options.mimeType ?? (blob.type || "audio/webm");
    const file = new File([blob], fileName, { type: mimeType });

    formData.append("file", file);
    formData.append("source", options.source);

    if (typeof options.durationSeconds === "number") {
        formData.append("durationSeconds", String(options.durationSeconds));
    }

    if (options.metadata) {
        formData.append("metadata", JSON.stringify(options.metadata));
    }

    return apiClient.postForm<{ data: SessionAudio }>(
        `/sessions/${sessionId}/audio`,
        formData,
    );
}

export function getSessionAudio(sessionId: string) {
    return apiClient.get<{ data: SessionAudio[] }>(`/sessions/${sessionId}/audio`);
}