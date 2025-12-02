import { MESSAGE_TYPES } from '@/utils/constants';
import { getAudioData, deleteAudioData, getAllAudioDataIds } from '@/utils/indexedDB';

class AudioRecorderService {
  private stream: MediaStream | null = null;

  /**
   * 녹음 시작
   */
  async startRecording(streamId: string): Promise<any> {
    try {
      console.log('Sending START_RECORDING message to background, streamId:', streamId);
      
      // Background script에 녹음 시작 요청 (streamId 전달)
      const response = await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.START_RECORDING,
        payload: { streamId },
      });

      console.log('Response from background:', response);

      if (response?.error) {
        throw new Error(response.error);
      }

      if (!response?.success) {
        throw new Error('Background 스크립트에서 응답이 없습니다. 익스텐션을 다시 로드해주세요.');
      }

      console.log('Recording started successfully');
      return response;
    } catch (error: any) {
      console.error('Failed to start recording:', error);
      
      // Chrome runtime 에러 체크
      if (chrome.runtime.lastError) {
        throw new Error(`Chrome 에러: ${chrome.runtime.lastError.message}`);
      }
      
      throw error;
    }
  }

  /**
   * 녹음 정지
   */
  async stopRecording(): Promise<Blob> {
    try {
      console.log('AudioRecorder: Sending STOP_RECORDING message to background...');
      const response = await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.STOP_RECORDING,
      });

      console.log('AudioRecorder: ==========================================');
      console.log('AudioRecorder: Got response from background');
      console.log('AudioRecorder: Response type:', typeof response);
      console.log('AudioRecorder: Response is null/undefined:', response === null || response === undefined);
      
      if (!response) {
        console.error('AudioRecorder: ❌ Response is null or undefined!');
        console.error('AudioRecorder: chrome.runtime.lastError:', chrome.runtime.lastError);
        throw new Error(`Background 스크립트에서 응답을 받지 못했습니다. ${chrome.runtime.lastError?.message || '알 수 없는 오류'}`);
      }

      if (response.error) {
        console.error('AudioRecorder: ❌ Response contains error:', response.error);
        throw new Error(response.error);
      }
      
      if (!response.success) {
        console.error('AudioRecorder: ❌ Response success is false');
        console.error('AudioRecorder: Full response:', response);
        throw new Error('Background 스크립트에서 녹음 정지에 실패했습니다.');
      }

      console.log('AudioRecorder: Response keys:', Object.keys(response));
      console.log('AudioRecorder: response.success:', response.success);
      console.log('AudioRecorder: response.storageKey exists:', 'storageKey' in response);
      console.log('AudioRecorder: response.storageKey value:', response.storageKey);
      console.log('AudioRecorder: response.audioDataBase64 exists:', 'audioDataBase64' in response);
      
      // ⚠️ 중요: Chrome 메시지 라우팅 버그로 인해 Offscreen의 응답이 직접 올 수 있음
      // audioDataBase64가 있고 storageKey가 없으면 Offscreen 응답이므로 IndexedDB에서 최근 키 찾기
      if (response.audioDataBase64 && !response.storageKey) {
        console.warn('AudioRecorder: ⚠️ WARNING: Received audioDataBase64 without storageKey (this is Offscreen response)!');
        console.warn('AudioRecorder: This is likely due to Chrome message routing bug.');
        console.warn('AudioRecorder: Searching for recent recording key in IndexedDB...');
        
        // Background가 IndexedDB에 저장할 시간을 주기 위해 짧은 지연
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // IndexedDB에서 최근 녹음 키 찾기
        const allIds = await getAllAudioDataIds();
        
        if (allIds.length > 0) {
          // 가장 최근 키 사용 (타임스탬프가 가장 큰 것)
          const recordingKeys = allIds.filter(key => key.startsWith('recording_'));
          if (recordingKeys.length > 0) {
            recordingKeys.sort().reverse();
            const latestKey = recordingKeys[0];
            console.log('AudioRecorder: ✅ Found recent recording key in IndexedDB:', latestKey);
            response.storageKey = latestKey;
            
            // audioDataBase64는 무시 (IndexedDB에서 가져올 것이므로)
            delete response.audioDataBase64;
          } else {
            console.error('AudioRecorder: ❌ No recording keys found in IndexedDB');
            throw new Error('IndexedDB에서 녹음 키를 찾을 수 없습니다. 녹음이 정상적으로 완료되지 않았을 수 있습니다.');
          }
        } else {
          console.error('AudioRecorder: ❌ No keys found in IndexedDB');
          throw new Error('IndexedDB에서 녹음 데이터를 찾을 수 없습니다. 녹음이 정상적으로 완료되지 않았을 수 있습니다.');
        }
      }

      // storageKey가 없으면 에러
      if (!response.storageKey) {
        console.error('AudioRecorder: ❌ No storageKey in response');
        console.error('AudioRecorder: Full response:', JSON.stringify(response).substring(0, 500));
        throw new Error('IndexedDB 키를 받지 못했습니다. 녹음이 정상적으로 완료되지 않았을 수 있습니다.');
      }
      
      console.log('AudioRecorder: ✅ Found storageKey:', response.storageKey);
      console.log('AudioRecorder: ==========================================');

      console.log('AudioRecorder: Got storageKey:', response.storageKey);
      console.log('AudioRecorder: Expected size:', response.audioBlobSize);
      
      // IndexedDB에서 데이터 가져오기
      console.log('AudioRecorder: Fetching from IndexedDB...');
      const audioData = await getAudioData(response.storageKey);
      
      if (!audioData) {
        console.error('AudioRecorder: ❌ No audioData in IndexedDB for key:', response.storageKey);
        throw new Error(`IndexedDB에서 오디오 데이터를 찾을 수 없습니다 (key: ${response.storageKey}).`);
      }
      
      if (!audioData.audioBlobBase64) {
        console.error('AudioRecorder: ❌ No audioBlobBase64 in audioData');
        throw new Error('IndexedDB의 오디오 데이터에 base64 인코딩된 데이터가 없습니다.');
      }
      
      console.log('AudioRecorder: Retrieved from storage, base64 length:', audioData.audioBlobBase64.length);
      console.log('AudioRecorder: Expected size:', audioData.audioBlobSize);
      console.log('AudioRecorder: Expected type:', audioData.audioBlobType);
      
      // Base64를 디코딩하여 Blob 생성
      let audioBlob: Blob;
      try {
        const base64String = audioData.audioBlobBase64;
        
        if (!base64String || base64String.length === 0) {
          throw new Error('Base64 string is empty');
        }
        
        console.log('AudioRecorder: Decoding base64 string...');
        const binaryString = atob(base64String);
        console.log('AudioRecorder: Binary string length:', binaryString.length);
        
        const uint8Array = new Uint8Array(binaryString.length);
        
        for (let i = 0; i < binaryString.length; i++) {
          uint8Array[i] = binaryString.charCodeAt(i);
        }
        
        console.log('AudioRecorder: Creating blob from Uint8Array...');
        audioBlob = new Blob([uint8Array], { type: audioData.audioBlobType || 'audio/webm' });
        
        console.log('✅ Created blob from base64, size:', audioBlob.size, 'type:', audioBlob.type);
        
        if (audioBlob.size !== audioData.audioBlobSize) {
          console.warn(`⚠️ Size mismatch! Expected: ${audioData.audioBlobSize}, Got: ${audioBlob.size}`);
          // 크기가 너무 차이나면 에러로 처리
          const sizeDiff = Math.abs(audioBlob.size - audioData.audioBlobSize);
          const sizeDiffPercent = (sizeDiff / audioData.audioBlobSize) * 100;
          if (sizeDiffPercent > 10) {
            console.error(`❌ Size difference too large: ${sizeDiffPercent.toFixed(2)}%`);
            throw new Error(`오디오 데이터 크기가 일치하지 않습니다. 예상: ${audioData.audioBlobSize} bytes, 실제: ${audioBlob.size} bytes`);
          }
        }
        
        if (audioBlob.size === 0) {
          throw new Error('디코딩된 Blob 크기가 0입니다.');
        }
      } catch (decodeError: any) {
        console.error('❌ Failed to decode base64 audio data:', decodeError);
        throw new Error(`오디오 데이터 디코딩 실패: ${decodeError.message || '알 수 없는 오류'}`);
      }
      
      // IndexedDB에서 데이터 삭제 (정리) - 하지만 성공한 경우에만
      try {
        await deleteAudioData(response.storageKey);
        console.log('AudioRecorder: Cleaned up IndexedDB');
      } catch (cleanupError) {
        console.warn('⚠️ Failed to cleanup IndexedDB (non-critical):', cleanupError);
      }
      
      console.log('AudioRecorder: ✅ Returning blob, size:', audioBlob.size);
      return audioBlob;
    } catch (error) {
      console.error('Failed to stop recording:', error);
      throw error;
    }
  }

  /**
   * 현재 녹음 상태 가져오기
   */
  async getRecordingStatus(): Promise<any> {
    try {
      const response = await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.GET_RECORDING_STATUS,
      });
      return response;
    } catch (error) {
      console.error('Failed to get recording status:', error);
      throw error;
    }
  }

  /**
   * 정리
   */
  cleanup(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
  }
}

export default new AudioRecorderService();

