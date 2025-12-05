import { create } from 'zustand';

export type RealtimeStatus = 'idle' | 'connecting' | 'connected' | 'error' | 'stopped';
export type RealtimePurpose = 'summary' | 'translation';

// 지원 언어 목록
export const SUPPORTED_LANGUAGES = [
  { code: 'ko', name: '한국어' },
  { code: 'en', name: 'English' },
  { code: 'ja', name: '日本語' },
  { code: 'zh', name: '中文' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'pt', name: 'Português' },
  { code: 'ru', name: 'Русский' },
  { code: 'it', name: 'Italiano' },
] as const;

// 브라우저 언어 감지 함수
export const detectBrowserLanguage = (): string => {
  const browserLang = navigator.language || (navigator as any).userLanguage || 'ko';
  const langCode = browserLang.split('-')[0].toLowerCase();
  const supported = SUPPORTED_LANGUAGES.find(lang => lang.code === langCode);
  return supported ? langCode : 'en';
};

export interface RealtimeConfig {
  language: string;        // 입력 언어 (음성 언어)
  responseLanguage: string; // 응답 언어 (번역/요약 결과 언어)
  purpose: RealtimePurpose; // 처리 목적: 'summary' | 'translation'
}

// 메모 아이템 인터페이스
export interface MemoItem {
  id: string;
  timestamp: string; // 녹음 시간 (예: "00:05:23")
  content: string;
  createdAt: number;
}

export interface RealtimeState {
  // 연결 상태
  status: RealtimeStatus;
  sessionId: string | null;
  error: string | null;

  // 전사 결과
  transcription: string;
  isTranscribing: boolean;

  // 번역 결과 (번역 모드)
  translation: string;
  isTranslating: boolean;

  // 요약 결과 (요약 모드 - 마크다운)
  summary: string;

  // 메모 목록
  memoList: MemoItem[];

  // 설정
  config: RealtimeConfig;

  // 액션
  setStatus: (status: RealtimeStatus) => void;
  setSessionId: (sessionId: string | null) => void;
  setError: (error: string | null) => void;
  
  updateTranscription: (text: string, isDelta?: boolean) => void;
  setIsTranscribing: (isTranscribing: boolean) => void;
  
  updateTranslation: (text: string, isDelta?: boolean) => void;
  setIsTranslating: (isTranslating: boolean) => void;
  
  setSummary: (summary: string) => void;
  
  addMemo: (timestamp: string, content: string) => void;
  clearMemoList: () => void;
  
  setConfig: (config: Partial<RealtimeConfig>) => void;
  
  reset: () => void;
  resetResults: () => void;
}

// 기본 설정값
const getDefaultConfig = (): RealtimeConfig => ({
  language: detectBrowserLanguage(), // 입력 언어: 브라우저 언어
  responseLanguage: detectBrowserLanguage(), // 응답 언어: 브라우저 언어
  purpose: 'summary', // 기본: 요약정리 모드
});

const initialState = {
  status: 'idle' as RealtimeStatus,
  sessionId: null,
  error: null,
  transcription: '',
  isTranscribing: false,
  translation: '',
  isTranslating: false,
  summary: '',
  memoList: [] as MemoItem[],
  config: getDefaultConfig(),
};

const useRealtimeStore = create<RealtimeState>((set) => ({
  ...initialState,

  setStatus: (status) => set({ status }),
  
  setSessionId: (sessionId) => set({ sessionId }),
  
  setError: (error) => set({ error }),

  updateTranscription: (text, isDelta = false) => {
    if (isDelta) {
      set({ transcription: text, isTranscribing: true });
    } else {
      set({ transcription: text, isTranscribing: false });
    }
  },

  setIsTranscribing: (isTranscribing) => set({ isTranscribing }),

  updateTranslation: (text, isDelta = false) => {
    if (isDelta) {
      set({ translation: text, isTranslating: true });
    } else {
      set({ translation: text, isTranslating: false });
    }
  },

  setIsTranslating: (isTranslating) => set({ isTranslating }),

  setSummary: (summary) => set({ summary }),

  addMemo: (timestamp, content) => set((state) => ({
    memoList: [
      ...state.memoList,
      {
        id: `memo_${Date.now()}`,
        timestamp,
        content,
        createdAt: Date.now(),
      },
    ],
  })),

  clearMemoList: () => set({ memoList: [] }),

  setConfig: (config) => set((state) => ({
    config: { ...state.config, ...config },
  })),

  reset: () => set({ ...initialState, config: getDefaultConfig() }),

  resetResults: () => set({
    transcription: '',
    isTranscribing: false,
    translation: '',
    isTranslating: false,
    summary: '',
    error: null,
  }),
}));

// 메모 목록을 텍스트로 변환하는 유틸리티 함수
export const getMemoListText = (): string => {
  const { memoList } = useRealtimeStore.getState();
  if (memoList.length === 0) return '';
  
  return memoList
    .map((memo: MemoItem) => `[${memo.timestamp}] ${memo.content}`)
    .join('\n');
};

export default useRealtimeStore;
