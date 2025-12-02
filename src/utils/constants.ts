// 녹음 관련 상수
export const MAX_RECORDING_DURATION = 60 * 60; // 60분 (초 단위)
export const RECORDING_MIME_TYPE = 'audio/webm';

// 최대 오디오 파일 크기 (24MB, 25MB 제한보다 작게 설정)
export const MAX_AUDIO_FILE_SIZE = 24 * 1024 * 1024; // 24MB (bytes)

// 오디오 녹음 비트레이트 (64kbps - STT 인식 가능한 품질 유지)
export const AUDIO_BITRATE = 64000; // 64kbps

// 예상 녹음 시간 계산: 64kbps 기준, 24MB는 약 51분 정도
// 64kbps = 8KB/sec, 24MB = 24 * 1024 KB / 8 KB/sec = 3072초 = 약 51.2분
export const MAX_RECORDING_DURATION_FOR_SIZE = Math.floor((MAX_AUDIO_FILE_SIZE * 8) / AUDIO_BITRATE); // 초 단위

// Storage 키
export const STORAGE_KEYS = {
  RECORDINGS: 'recordings',
  SETTINGS: 'settings',
  API_KEY: 'apiKey',
} as const;

// 메시지 타입
export const MESSAGE_TYPES = {
  START_RECORDING: 'START_RECORDING',
  STOP_RECORDING: 'STOP_RECORDING',
  RECORDING_DATA: 'RECORDING_DATA',
  RECORDING_ERROR: 'RECORDING_ERROR',
  GET_RECORDING_STATUS: 'GET_RECORDING_STATUS',
  TRANSCRIBE_AUDIO: 'TRANSCRIBE_AUDIO',
} as const;

// 백엔드 API 설정 (ngrok 또는 프로덕션 URL)
export const BACKEND_API_URL = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:8080';
export const EXTENSION_API_KEY = import.meta.env.VITE_EXTENSION_API_KEY || '';


