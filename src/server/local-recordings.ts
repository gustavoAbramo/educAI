import type { RecordingUploadRequest, VoiceRecording } from "@/lib/voice-intelligence";

export type PendingRecordingUpload = RecordingUploadRequest & {
  file?: File;
  bytes?: ArrayBuffer;
};

export type StoredRecordingBytes = {
  bytes: Uint8Array;
  fileName: string;
  mimeType: string;
};

type RuntimeGlobal = typeof globalThis & {
  process?: {
    cwd?: () => string;
    env?: Record<string, string | undefined>;
  };
};

async function loadNodeFileSystem() {
  try {
    const [fs, path] = await Promise.all([import("node:fs/promises"), import("node:path")]);
    return { fs, path };
  } catch {
    return null;
  }
}

function getRecordingsRoot(path: typeof import("node:path")) {
  const runtime = globalThis as RuntimeGlobal;
  const cwd = runtime.process?.cwd?.();
  if (!cwd) return undefined;

  return runtime.process?.env?.EDUCAI_RECORDINGS_DIR ?? path.join(cwd, ".data", "recordings");
}

function safeFileName(fileName: string) {
  return (
    fileName
      .trim()
      .replace(/[<>:"/\\|?*]/g, "-")
      .split("")
      .filter((char) => char.charCodeAt(0) >= 32)
      .join("")
      .replace(/\s+/g, " ")
      .slice(0, 160) || "recording.webm"
  );
}

function getExtension(fileName: string, mimeType?: string) {
  const ext = fileName.includes(".") ? fileName.split(".").at(-1) : undefined;
  if (ext && ext.length <= 8) return ext.toLowerCase();

  if (mimeType?.includes("mpeg")) return "mp3";
  if (mimeType?.includes("mp4")) return "mp4";
  if (mimeType?.includes("m4a")) return "m4a";
  if (mimeType?.includes("wav")) return "wav";
  if (mimeType?.includes("webm")) return "webm";
  return "bin";
}

function resolvePathWithinRoot(path: typeof import("node:path"), root: string, target: string) {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(target);
  const relative = path.relative(resolvedRoot, resolvedTarget);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Recording path is outside the configured recordings directory.");
  }
  return resolvedTarget;
}

async function uploadToBytes(upload: PendingRecordingUpload): Promise<Uint8Array | undefined> {
  if (upload.file) {
    return new Uint8Array(await upload.file.arrayBuffer());
  }

  if (upload.bytes) {
    return new Uint8Array(upload.bytes);
  }

  return undefined;
}

export async function persistRecordingUpload(
  sessionId: string,
  upload: PendingRecordingUpload,
): Promise<RecordingUploadRequest> {
  const bytes = await uploadToBytes(upload);
  if (!bytes) return upload;

  const node = await loadNodeFileSystem();
  if (!node) return upload;

  const root = getRecordingsRoot(node.path);
  if (!root) return upload;

  const fileName = safeFileName(upload.fileName ?? upload.file?.name ?? "recording.webm");
  const mimeType = upload.mimeType ?? upload.file?.type ?? "application/octet-stream";
  const extension = getExtension(fileName, mimeType);
  const key = `${sessionId}/${crypto.randomUUID()}.${extension}`;
  const absolutePath = node.path.join(root, key);

  await node.fs.mkdir(node.path.dirname(absolutePath), { recursive: true });
  await node.fs.writeFile(absolutePath, bytes);

  return {
    ...upload,
    fileName,
    mimeType,
    sizeBytes: bytes.byteLength,
    status: "UPLOADED",
    storage: {
      provider: "local",
      key,
      path: absolutePath,
      savedAt: new Date().toISOString(),
    },
  } as RecordingUploadRequest;
}

export async function readStoredRecording(
  recording: VoiceRecording,
): Promise<StoredRecordingBytes | undefined> {
  if (recording.storage?.provider !== "local") return undefined;

  const node = await loadNodeFileSystem();
  if (!node) return undefined;

  const root = getRecordingsRoot(node.path);
  if (!root) return undefined;

  const candidatePath = recording.storage.path ?? node.path.join(root, recording.storage.key);
  const filePath = resolvePathWithinRoot(node.path, root, candidatePath);

  const bytes = await node.fs.readFile(filePath);
  return {
    bytes,
    fileName: recording.fileName,
    mimeType: recording.mimeType,
  };
}

// Apaga a pasta de audios de uma sessao. O id e validado e o caminho tem de
// ficar dentro da pasta de gravacoes, para nunca apagar nada fora dela.
export async function deleteStoredRecordings(sessionId: string) {
  if (!/^ses_[\w-]+$/.test(sessionId)) return;

  const node = await loadNodeFileSystem();
  if (!node) return;

  const root = getRecordingsRoot(node.path);
  if (!root) return;

  const directory = resolvePathWithinRoot(node.path, root, node.path.join(root, sessionId));
  await node.fs.rm(directory, { recursive: true, force: true });
}
