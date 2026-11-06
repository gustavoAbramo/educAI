export type LiveSpeaker = {
  id: string;
  name: string;
};

export type LiveTranscriptSegment = {
  id: string;
  speakerId: string;
  speakerName: string;
  text: string;
  confidence?: number;
  technicalTerms?: string[];
  clarity?: number;
  intonation?: number;
  conviction?: number;
  speakerRole?: string;
  themeLabel?: string;
  verbalQuality?: "adequada" | "revisar";
  createdAt: number;
};

export type LiveAudioSample = {
  at: number;
  rms: number;
  zcr: number;
  pitch?: number;
};

export type SpeakerMode = "auto" | "manual";

export type LessonAudioSettings = {
  captureMode: "microphone" | "microphone_and_system";
  diarizationMode: "off" | "speaker_labels" | "speaker_labels_with_names";
  preserveSourceTracks: boolean;
};

export type MeetingAudioCaptureStatus =
  | "not_requested"
  | "pending"
  | "active"
  | "missing"
  | "blocked"
  | "unsupported"
  | "stopped";

export type MeetingAudioCaptureDiagnostics = {
  status: MeetingAudioCaptureStatus;
  message: string;
  trackCount: number;
  trackLabel?: string;
  updatedAt: string;
};

export type LessonRecordingBlobs = {
  microphone: Blob | null;
  system: Blob | null;
};
