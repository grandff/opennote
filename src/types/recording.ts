// 오디오 세그먼트 (20분 단위로 분할된 파일)
export interface AudioSegment {
  id: string;
  index: number; // 0, 1, 2, ...
  startTime: number; // 세그먼트 시작 시간 (초)
  endTime: number; // 세그먼트 종료 시간 (초)
  duration: number; // 세그먼트 길이 (초)
  blob: Blob;
  url?: string;
}

export interface Recording {
  id: string;
  timestamp: number;
  duration: number; // 총 녹음 시간 (초 단위)
  audioBlob?: Blob; // 단일 파일 (무료 사용자 또는 20분 이하)
  audioUrl?: string;
  audioSegments?: AudioSegment[]; // 분할된 파일 목록 (유료 사용자, 20분 이상)
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


