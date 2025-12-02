import { create } from 'zustand';
import { Recording, RecordingStatus } from '@/types/recording';

interface RecordingStore {
  // 상태
  status: RecordingStatus;
  currentRecording: Recording | null;
  recordings: Recording[];
  startTime: number | null;
  elapsedTime: number;

  // 액션
  setStatus: (status: RecordingStatus) => void;
  startRecording: () => void;
  stopRecording: (audioBlob: Blob) => void;
  updateElapsedTime: (time: number) => void;
  setCurrentRecording: (recording: Recording | null) => void;
  addRecording: (recording: Recording) => void;
  deleteRecording: (id: string) => void;
  reset: () => void;
}

const useRecordingStore = create<RecordingStore>((set, get) => ({
  // 초기 상태
  status: 'idle',
  currentRecording: null,
  recordings: [],
  startTime: null,
  elapsedTime: 0,

  // 액션
  setStatus: (status) => set({ status }),

  startRecording: () => {
    const now = Date.now();
    const newRecording: Recording = {
      id: `recording-${now}`,
      timestamp: now,
      duration: 0,
      isPaused: false,
    };

    set({
      status: 'recording',
      currentRecording: newRecording,
      startTime: now,
      elapsedTime: 0,
    });
  },

  stopRecording: (audioBlob: Blob) => {
    console.log('Store: stopRecording called with blob:', audioBlob);
    console.log('Blob size:', audioBlob?.size);
    console.log('Blob type:', audioBlob?.type);
    
    const state = get();
    const { currentRecording, elapsedTime } = state;
    console.log('Current recording:', currentRecording);
    console.log('Elapsed time:', elapsedTime);
    
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
      
      const finalRecording: Recording = {
        ...currentRecording,
        duration: finalDuration,
        audioBlob,
        audioUrl,
        isPaused: false,
      };

      console.log('Final recording:', finalRecording);
      console.log('Setting status to stopped - this should stop the timer');

      set({
        status: 'stopped',
        currentRecording: finalRecording,
        elapsedTime: finalDuration, // duration과 동기화
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
    });
    console.log('Store: reset complete, status:', get().status);
  },
}));

export default useRecordingStore;

