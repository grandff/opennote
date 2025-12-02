import { useEffect, useCallback } from 'react';
import useRecordingStore from '@/stores/recordingStore';
import audioRecorder from '@/services/audioRecorder';
import { formatDuration } from '@/utils/timeUtils';
import { MAX_RECORDING_DURATION, MAX_AUDIO_FILE_SIZE } from '@/utils/constants';

export const useRecording = () => {
  const {
    status,
    currentRecording,
    elapsedTime,
    startRecording,
    stopRecording,
    updateElapsedTime,
    reset,
  } = useRecordingStore();

  // 타이머 업데이트
  useEffect(() => {
    console.log('Timer effect - status:', status, 'elapsedTime:', elapsedTime);
    
    if (status !== 'recording') {
      console.log('Timer stopped - status is not recording:', status);
      return; // 녹음 중이 아니면 타이머 정지
    }

    const interval = setInterval(() => {
      const currentStatus = useRecordingStore.getState().status;
      
      // 다시 한 번 체크 (status가 변경되었을 수 있음)
      if (currentStatus !== 'recording') {
        console.log('Timer: status changed to', currentStatus, '- stopping timer');
        clearInterval(interval);
        return;
      }

      const currentElapsed = useRecordingStore.getState().elapsedTime;
      // elapsedTime이 유효하지 않으면 0으로 초기화
      const validElapsed = (currentElapsed && isFinite(currentElapsed) && currentElapsed >= 0) 
        ? currentElapsed 
        : 0;
      const newElapsedTime = validElapsed + 1;
      updateElapsedTime(newElapsedTime);

      // 최대 녹음 시간 체크 (60분)
      if (newElapsedTime >= MAX_RECORDING_DURATION) {
        console.log('Max recording time reached');
        clearInterval(interval);
      }
    }, 1000);

    return () => {
      console.log('Clearing timer interval, status:', status);
      clearInterval(interval);
    };
  }, [status, updateElapsedTime]);

  // 녹음 시작
  const handleStart = useCallback(async () => {
    try {
      // Side Panel에서는 activeTab 권한이 자동으로 활성화되지 않을 수 있음
      // Background에서 탭을 찾고 getMediaStreamId를 호출하도록 변경
      console.log('Requesting Background to start recording...');
      
      const response = await chrome.runtime.sendMessage({
        type: 'START_RECORDING_WITH_TAB',
      }) as { success?: boolean; error?: string; streamId?: string };
      
      if (response?.error) {
        throw new Error(response.error);
      }
      
      if (!response?.success) {
        throw new Error('Background 스크립트에서 응답이 없습니다. 익스텐션을 다시 로드해주세요.');
      }

      console.log('Recording started successfully');
      
      startRecording();
    } catch (error: any) {
      console.error('Failed to start recording:', error);
      
      // 에러 메시지 개선
      let errorMessage = '녹음 시작에 실패했습니다.';
      
      if (error.message.includes('Cannot capture') || error.message.includes('tab capture')) {
        errorMessage = `녹음 실패: ${error.message}\n\n해결 방법:\n1. 기존 녹음을 완전히 정지했는지 확인\n2. 익스텐션을 다시 로드\n3. Chrome 재시작\n4. YouTube 등 일반 사이트에서 시도`;
      } else if (error.message.includes('페이지')) {
        errorMessage = error.message;
      } else if (error.message.includes('already in progress') || error.message.includes('still exists')) {
        errorMessage = '이전 녹음 세션이 완전히 종료되지 않았습니다. 잠시 후 다시 시도해주세요.';
      } else {
        errorMessage = `녹음 실패: ${error.message}\n\n해결 방법:\n1. 기존 녹음을 완전히 정지했는지 확인\n2. 익스텐션을 다시 로드\n3. Chrome 재시작\n4. YouTube 등 일반 사이트에서 시도`;
      }
      
      alert(errorMessage);
    }
  }, [startRecording]);

  // 녹음 정지
  const handleStop = useCallback(async () => {
    try {
      console.log('=== useRecording: Stopping recording ===');
      console.log('Current status:', useRecordingStore.getState().status);
      console.log('Current elapsedTime:', useRecordingStore.getState().elapsedTime);
      
      // 타이머가 멈추기 전에 현재 elapsedTime 저장 (최종 duration)
      const finalElapsedTime = useRecordingStore.getState().elapsedTime;
      console.log('Final elapsed time before stopping:', finalElapsedTime);
      
      console.log('Calling audioRecorder.stopRecording()...');
      const audioBlob = await audioRecorder.stopRecording();
      
      console.log('=== useRecording: Got response from audioRecorder.stopRecording() ===');
      console.log('audioBlob:', audioBlob);
      console.log('audioBlob type:', typeof audioBlob);
      console.log('audioBlob instanceof Blob:', audioBlob instanceof Blob);
      console.log('Blob size:', audioBlob?.size);
      console.log('Blob type:', audioBlob?.type);
      
      // 15 bytes는 빈 파일 (헤더만)
      if (!audioBlob) {
        console.error('❌ audioBlob is null or undefined!');
        throw new Error('녹음 데이터를 가져올 수 없습니다. 다시 시도해주세요.');
      }
      
      if (!(audioBlob instanceof Blob)) {
        console.error('❌ audioBlob is not a Blob instance!', audioBlob);
        throw new Error('녹음 데이터 형식이 올바르지 않습니다.');
      }
      
      if (audioBlob.size < 100) {
        console.error('❌ Blob too small or empty:', audioBlob.size);
        throw new Error(`녹음 데이터가 너무 작습니다 (${audioBlob.size} bytes). 최소 1초 이상 녹음해주세요.`);
      }
      
      // 24MB 제한 체크
      if (audioBlob.size > MAX_AUDIO_FILE_SIZE) {
        console.error(`❌ Blob size exceeds limit: ${(audioBlob.size / 1024 / 1024).toFixed(2)}MB (limit: ${(MAX_AUDIO_FILE_SIZE / 1024 / 1024).toFixed(2)}MB)`);
        throw new Error(`녹음 파일 크기가 24MB를 초과했습니다 (${(audioBlob.size / 1024 / 1024).toFixed(2)}MB). 녹음 시간을 줄여주세요.`);
      }
      
      console.log('✅ Valid blob received, updating store...');
      console.log('Blob size:', `${(audioBlob.size / 1024 / 1024).toFixed(2)}MB`, `(${audioBlob.size} bytes)`);
      console.log('Blob type:', audioBlob.type);
      
      // elapsedTime을 최종값으로 설정 (타이머가 멈춘 후 업데이트 방지)
      useRecordingStore.setState({ elapsedTime: finalElapsedTime });
      
      console.log('Calling stopRecording(audioBlob) to update store...');
      stopRecording(audioBlob);
      
      // store 업데이트 확인
      const updatedState = useRecordingStore.getState();
      console.log('=== useRecording: Store updated ===');
      console.log('Updated status:', updatedState.status);
      console.log('Updated currentRecording:', updatedState.currentRecording);
      console.log('Has audioBlob in store:', !!updatedState.currentRecording?.audioBlob);
      console.log('Has audioUrl in store:', !!updatedState.currentRecording?.audioUrl);
      console.log('AudioBlob size in store:', updatedState.currentRecording?.audioBlob?.size);
      
      if (!updatedState.currentRecording?.audioBlob) {
        console.error('❌ audioBlob not found in store after stopRecording!');
        throw new Error('녹음 데이터 저장에 실패했습니다.');
      }
      
      console.log('✅ Store updated, recording stopped successfully');
    } catch (error: any) {
      console.error('❌ Failed to stop recording:', error);
      console.error('Error type:', typeof error);
      console.error('Error message:', error?.message);
      console.error('Error stack:', error?.stack);
      throw error; // 에러를 다시 throw하여 Popup에서 처리할 수 있도록
    }
  }, [stopRecording]);

  // 초기화
  const handleReset = useCallback(() => {
    reset();
  }, [reset]);

  return {
    status,
    currentRecording,
    duration: formatDuration(elapsedTime),
    elapsedTime,
    handleStart,
    handleStop,
    handleReset,
  };
};

