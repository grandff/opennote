export interface Recording {
  id: string;
  timestamp: number;
  duration: number; // 초 단위
  audioBlob?: Blob;
  audioUrl?: string;
  transcription?: string;
  summary?: string;
  notes?: string;
  isPaused: boolean;
}

export type RecordingStatus = 'idle' | 'recording' | 'stopped';

export interface RecordingState {
  status: RecordingStatus;
  currentRecording: Recording | null;
  recordings: Recording[];
  startTime: number | null;
  pausedTime: number;
  elapsedTime: number;
}


