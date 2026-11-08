// Regras do arquivo de audio/video enviado na criacao da sessao.
// O limite abaixo acompanha o padrao da API (`EDUCAI_MAX_AUDIO_UPLOAD_BYTES`).
export const MAX_MEDIA_UPLOAD_BYTES = 500 * 1024 * 1024;

// Acima disso a maioria dos provedores de transcricao recusa o arquivo.
export const PROVIDER_SAFE_MEDIA_BYTES = 25 * 1024 * 1024;

export type MediaKind = "audio" | "video";

const audioExtensions = new Set([
  "mp3",
  "m4a",
  "aac",
  "wav",
  "wave",
  "ogg",
  "oga",
  "opus",
  "flac",
  "webm",
  "wma",
  "amr",
  "aiff",
  "aif",
]);

const videoExtensions = new Set([
  "mp4",
  "m4v",
  "mov",
  "mkv",
  "avi",
  "wmv",
  "mpeg",
  "mpg",
  "3gp",
  "ogv",
]);

const mimeByExtension: Record<string, string> = {
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  aac: "audio/aac",
  wav: "audio/wav",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  opus: "audio/opus",
  flac: "audio/flac",
  webm: "audio/webm",
  mp4: "video/mp4",
  m4v: "video/mp4",
  mov: "video/quicktime",
  mkv: "video/x-matroska",
  avi: "video/x-msvideo",
  wmv: "video/x-ms-wmv",
  mpeg: "video/mpeg",
  mpg: "video/mpeg",
};

export function fileExtension(fileName: string) {
  const match = /\.([^.]+)$/.exec(fileName.trim());
  return match ? match[1].toLowerCase() : "";
}

export function mediaKindOf(file: File): MediaKind {
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  return videoExtensions.has(fileExtension(file.name)) ? "video" : "audio";
}

export function mimeTypeForMedia(file: File) {
  if (file.type) return file.type;
  return mimeByExtension[fileExtension(file.name)] ?? "application/octet-stream";
}

export function isSupportedMedia(file: File) {
  if (file.type.startsWith("audio/") || file.type.startsWith("video/")) return true;
  const extension = fileExtension(file.name);
  return audioExtensions.has(extension) || videoExtensions.has(extension);
}

export function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function formatMediaDuration(seconds: number | undefined) {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return "";
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${minutes}:${pad(secs)}`;
}

// Monta um titulo inicial a partir do nome do arquivo, para o usuario nao
// precisar digitar de novo quando ja tem uma aula gravada.
export function titleFromFileName(fileName: string) {
  const base = fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!base) return "";
  return base.charAt(0).toUpperCase() + base.slice(1);
}

export function mediaFileProblem(file: File) {
  if (file.size === 0) return "O arquivo está vazio. Escolha outro áudio ou vídeo.";
  if (!isSupportedMedia(file)) {
    return "Formato não suportado. Envie um áudio (mp3, m4a, wav, ogg, webm) ou um vídeo (mp4, mov, mkv).";
  }
  if (file.size > MAX_MEDIA_UPLOAD_BYTES) {
    return `O arquivo tem ${formatFileSize(file.size)} e o limite é ${formatFileSize(
      MAX_MEDIA_UPLOAD_BYTES,
    )}.`;
  }
  return "";
}

// Le a duracao no proprio navegador, sem enviar o arquivo antes da hora.
export function readMediaDuration(file: File, kind: MediaKind): Promise<number | undefined> {
  if (typeof document === "undefined") return Promise.resolve(undefined);

  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const element = document.createElement(kind === "video" ? "video" : "audio");
    element.preload = "metadata";

    const finish = (duration?: number) => {
      URL.revokeObjectURL(url);
      element.removeAttribute("src");
      resolve(duration);
    };

    element.onloadedmetadata = () => {
      const duration = element.duration;
      finish(Number.isFinite(duration) && duration > 0 ? duration : undefined);
    };
    element.onerror = () => finish(undefined);
    element.src = url;
  });
}
