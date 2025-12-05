import { create } from 'zustand';
import { Recording, RecordingStatus, AudioSegment } from '@/types/recording';
import { RECORDING_LIMITS } from '@/utils/constants';

interface RecordingStore {
  // 상태
  status: RecordingStatus;
  currentRecording: Recording | null;
  recordings: Recording[];
  startTime: number | null;
  elapsedTime: number;
  
  // 세그먼트 관련 상태
  currentSegments: AudioSegment[]; // 현재 녹음의 세그먼트 목록
  currentSegmentIndex: number; // 현재 세그먼트 인덱스
  segmentStartTime: number; // 현재 세그먼트 시작 시간 (초)
  isPremiumUser: boolean; // 유료 사용자 여부

  // 액션
  setStatus: (status: RecordingStatus) => void;
  startRecording: () => void;
  stopRecording: (audioBlob: Blob) => void;
  updateElapsedTime: (time: number) => void;
  setCurrentRecording: (recording: Recording | null) => void;
  addRecording: (recording: Recording) => void;
  deleteRecording: (id: string) => void;
  reset: () => void;
  
  // 세그먼트 관련 액션
  setIsPremiumUser: (isPremium: boolean) => void;
  addSegment: (blob: Blob) => void;
  getMaxDuration: () => number;
  shouldSplitSegment: () => boolean;
  finalizeSegment: (blob: Blob) => void;
}

const useRecordingStore = create<RecordingStore>((set, get) => ({
  // 초기 상태
  status: 'idle',
  currentRecording: null,
  recordings: [],
  startTime: null,
  elapsedTime: 0,
  
  // 세그먼트 관련 초기 상태
  currentSegments: [],
  currentSegmentIndex: 0,
  segmentStartTime: 0,
  isPremiumUser: false, // 기본값: 무료 사용자

  // 액션
  setStatus: (status) => set({ status }),

  startRecording: () => {
    const now = Date.now();
    const newRecording: Recording = {
      id: `recording-${now}`,
      timestamp: now,
      duration: 0,
      isPaused: false,
      audioSegments: [],
    };

    set({
      status: 'recording',
      currentRecording: newRecording,
      startTime: now,
      elapsedTime: 0,
      currentSegments: [],
      currentSegmentIndex: 0,
      segmentStartTime: 0,
    });
  },

  stopRecording: (audioBlob: Blob) => {
    console.log('Store: stopRecording called with blob:', audioBlob);
    console.log('Blob size:', audioBlob?.size);
    console.log('Blob type:', audioBlob?.type);
    
    const state = get();
    const { currentRecording, elapsedTime, currentSegments, segmentStartTime, isPremiumUser } = state;
    console.log('Current recording:', currentRecording);
    console.log('Elapsed time:', elapsedTime);
    console.log('Current segments:', currentSegments.length);
    
    if (!currentRecording) {
      console.error('No current recording to stop!');
      return;
    }
    
    if (!audioBlob || audioBlob.size === 0) {
      console.error('Invalid audio blob!');
      alert('녹음된 데이터가 없습니다.');
      return;
    }
    
    try {
      const audioUrl = URL.createObjectURL(audioBlob);
      console.log('Created audio URL:', audioUrl);
      
      // elapsedTime이 유효하지 않으면 0 사용 (타이머가 멈춘 후 NaN/Infinity일 수 있음)
      const finalDuration = (elapsedTime && isFinite(elapsedTime) && elapsedTime > 0) 
        ? elapsedTime 
        : 0;
      
      console.log('Using duration:', finalDuration, '(original elapsedTime:', elapsedTime, ')');
      
      // 유료 사용자이고 세그먼트가 있는 경우, 마지막 세그먼트 추가
      let finalSegments = [...currentSegments];
      if (isPremiumUser && finalDuration > RECORDING_LIMITS.SEGMENT_DURATION) {
        // 마지막 세그먼트 추가 (현재 블롭이 마지막 세그먼트)
        const lastSegment: AudioSegment = {
          id: `segment-${Date.now()}-${currentSegments.length}`,
          index: currentSegments.length,
          startTime: segmentStartTime,
          endTime: finalDuration,
          duration: finalDuration - segmentStartTime,
          blob: audioBlob,
          url: audioUrl,
        };
        finalSegments = [...currentSegments, lastSegment];
        console.log('Added final segment:', lastSegment);
      }
      
      const finalRecording: Recording = {
        ...currentRecording,
        duration: finalDuration,
        audioBlob: finalSegments.length === 0 ? audioBlob : undefined, // 세그먼트가 없으면 단일 파일
        audioUrl: finalSegments.length === 0 ? audioUrl : undefined,
        audioSegments: finalSegments.length > 0 ? finalSegments : undefined, // 세그먼트가 있으면 세그먼트 목록
        isPaused: false,
      };

      console.log('Final recording:', finalRecording);
      console.log('Total segments:', finalSegments.length);
      console.log('Setting status to stopped - this should stop the timer');

      set({
        status: 'stopped',
        currentRecording: finalRecording,
        elapsedTime: finalDuration, // duration과 동기화
        currentSegments: finalSegments,
      });
      
      console.log('Store updated successfully, status is now:', get().status);
      console.log('Final recording duration:', get().currentRecording?.duration);
    } catch (error) {
      console.error('Error in stopRecording:', error);
      alert('녹음 저장 중 오류가 발생했습니다.');
    }
  },

  updateElapsedTime: (time: number) => {
    const { currentRecording } = get();
    if (currentRecording) {
      set({
        elapsedTime: time,
        currentRecording: { ...currentRecording, duration: time },
      });
    }
  },

  setCurrentRecording: (recording) => set({ currentRecording: recording }),

  addRecording: (recording) => {
    set((state) => ({
      recordings: [recording, ...state.recordings],
    }));
  },

  deleteRecording: (id) => {
    set((state) => ({
      recordings: state.recordings.filter((r) => r.id !== id),
    }));
  },

  reset: () => {
    console.log('Store: reset called');
    set({
      status: 'idle',
      currentRecording: null,
      startTime: null,
      elapsedTime: 0,
      currentSegments: [],
      currentSegmentIndex: 0,
      segmentStartTime: 0,
    });
    console.log('Store: reset complete, status:', get().status);
  },

  // 세그먼트 관련 액션
  setIsPremiumUser: (isPremium) => set({ isPremiumUser: isPremium }),

  addSegment: (blob) => {
    const state = get();
    const { currentSegmentIndex, segmentStartTime, elapsedTime } = state;
    
    const segment: AudioSegment = {
      id: `segment-${Date.now()}-${currentSegmentIndex}`,
      index: currentSegmentIndex,
      startTime: segmentStartTime,
      endTime: elapsedTime,
      duration: elapsedTime - segmentStartTime,
      blob,
      url: URL.createObjectURL(blob),
    };

    set({
      currentSegments: [...state.currentSegments, segment],
      currentSegmentIndex: currentSegmentIndex + 1,
      segmentStartTime: elapsedTime,
    });

    console.log(`[Recording] Segment ${currentSegmentIndex} added:`, {
      startTime: segment.startTime,
      endTime: segment.endTime,
      duration: segment.duration,
      blobSize: blob.size,
    });
  },

  getMaxDuration: () => {
    const { isPremiumUser } = get();
    return isPremiumUser 
      ? RECORDING_LIMITS.PREMIUM_MAX_DURATION 
      : RECORDING_LIMITS.FREE_MAX_DURATION;
  },

  shouldSplitSegment: () => {
    const { elapsedTime, segmentStartTime, isPremiumUser } = get();
    if (!isPremiumUser) return false;
    
    const currentSegmentDuration = elapsedTime - segmentStartTime;
    return currentSegmentDuration >= RECORDING_LIMITS.SEGMENT_DURATION;
  },

  finalizeSegment: (blob) => {
    const state = get();
    const { currentSegmentIndex, segmentStartTime, elapsedTime } = state;
    
    const segment: AudioSegment = {
      id: `segment-${Date.now()}-${currentSegmentIndex}`,
      index: currentSegmentIndex,
      startTime: segmentStartTime,
      endTime: elapsedTime,
      duration: elapsedTime - segmentStartTime,
      blob,
      url: URL.createObjectURL(blob),
    };

    const updatedSegments = [...state.currentSegments, segment];
    
    // currentRecording 업데이트
    if (state.currentRecording) {
      set({
        currentSegments: updatedSegments,
        currentRecording: {
          ...state.currentRecording,
          audioSegments: updatedSegments,
        },
      });
    }

    console.log(`[Recording] Final segment ${currentSegmentIndex} added:`, {
      totalSegments: updatedSegments.length,
    });
  },
}));

export default useRecordingStore;

