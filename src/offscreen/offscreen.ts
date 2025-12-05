/// <reference types="chrome"/>

import { MAX_AUDIO_FILE_SIZE, RECORDING_LIMITS } from '@/utils/constants';

let mediaRecorder: MediaRecorder | null = null;
let audioChunks: Blob[] = [];
let audioContext: AudioContext | null = null;
let sourceNode: MediaStreamAudioSourceNode | null = null;
let currentStream: MediaStream | null = null;
let isManualStop: boolean = false;
let finalBlob: Blob | null = null;

// ===== 세그먼트 분할 관련 변수 =====
let segmentIndex: number = 0;
let segmentStartTime: number = 0;
let recordingStartTime: number = 0;
let isPremiumUser: boolean = false;
let savedSegments: Array<{ index: number; base64: string; startTime: number; endTime: number; size: number }> = [];

// ===== Realtime API를 위한 PCM 오디오 관련 변수 =====
let pcmAudioContext: AudioContext | null = null;
let pcmSourceNode: MediaStreamAudioSourceNode | null = null;
let pcmProcessor: ScriptProcessorNode | null = null;

/**
 * Float32Array를 PCM16 Base64로 변환
 * OpenAI Realtime API 요구사항: PCM16 24kHz mono
 */
function float32ToPCM16Base64(float32Array: Float32Array): string {
  // Float32 (-1.0 ~ 1.0) → Int16 (-32768 ~ 32767)
  const pcm16 = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  
  // Int16Array → Uint8Array → Base64
  const uint8 = new Uint8Array(pcm16.buffer);
  let binary = '';
  for (let i = 0; i < uint8.length; i++) {
    binary += String.fromCharCode(uint8[i]);
  }
  return btoa(binary);
}

/**
 * Realtime API용 PCM 오디오 스트림 시작
 * Web Audio API의 ScriptProcessorNode를 사용하여 PCM16 24kHz mono 데이터 추출
 */
function startPCMAudioStream(stream: MediaStream): void {
  try {
    // 24kHz AudioContext 생성
    pcmAudioContext = new AudioContext({ sampleRate: 24000 });
    pcmSourceNode = pcmAudioContext.createMediaStreamSource(stream);
    
    // ScriptProcessor로 PCM 데이터 추출 (bufferSize: 4096 → 약 170ms @ 24kHz)
    pcmProcessor = pcmAudioContext.createScriptProcessor(4096, 1, 1);
    
    pcmProcessor.onaudioprocess = (event) => {
      const float32Data = event.inputBuffer.getChannelData(0);
      const pcm16Base64 = float32ToPCM16Base64(float32Data);
      
      // Background로 PCM 오디오 청크 전송
      chrome.runtime.sendMessage({
        type: 'REALTIME_AUDIO_CHUNK',
        audioChunk: pcm16Base64,
        chunkSize: float32Data.length * 2, // PCM16 = 2 bytes per sample
        format: 'pcm16_24khz_mono',
      }).catch(() => {
        // 전송 실패해도 무시 (녹음에 영향 없음)
      });
    };
    
    // 연결: source → processor → destination (destination 연결 필수)
    pcmSourceNode.connect(pcmProcessor);
    pcmProcessor.connect(pcmAudioContext.destination);
    
    logToBackground('🎙️ PCM audio stream started (24kHz mono)');
  } catch (error) {
    console.warn('[Realtime] Error starting PCM audio stream:', error);
    // PCM 스트림 오류가 나도 메인 녹음에 영향 없음
  }
}

/**
 * Realtime API용 PCM 오디오 스트림 정지
 */
function stopPCMAudioStream(): void {
  try {
    if (pcmProcessor) {
      pcmProcessor.disconnect();
      pcmProcessor = null;
    }
    if (pcmSourceNode) {
      pcmSourceNode.disconnect();
      pcmSourceNode = null;
    }
    if (pcmAudioContext && pcmAudioContext.state !== 'closed') {
      pcmAudioContext.close();
      pcmAudioContext = null;
    }
    logToBackground('🎙️ PCM audio stream stopped');
  } catch (error) {
    console.warn('[Realtime] Error stopping PCM audio stream:', error);
  }
}

/**
 * 현재 세그먼트 저장 (20분마다 호출)
 * 현재까지 수집된 audioChunks를 Blob으로 만들어 저장하고, audioChunks를 비움
 */
async function saveCurrentSegment(): Promise<void> {
  if (audioChunks.length === 0) {
    logToBackground('⚠️ No audio chunks to save for segment');
    return;
  }

  const elapsedSeconds = Math.floor((Date.now() - recordingStartTime) / 1000);
  
  // 현재 청크들로 Blob 생성
  const segmentBlob = new Blob(audioChunks, { type: 'audio/webm;codecs=opus' });
  
  // Blob을 Base64로 변환
  const arrayBuffer = await segmentBlob.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  
  const chunkSize = 0x8000;
  let base64String = '';
  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
    base64String += String.fromCharCode.apply(null, Array.from(chunk));
  }
  base64String = btoa(base64String);
  
  // 세그먼트 저장
  savedSegments.push({
    index: segmentIndex,
    base64: base64String,
    startTime: segmentStartTime,
    endTime: elapsedSeconds,
    size: arrayBuffer.byteLength,
  });
  
  logToBackground(`📦 Segment ${segmentIndex} saved: ${segmentStartTime}s - ${elapsedSeconds}s (${(arrayBuffer.byteLength / 1024 / 1024).toFixed(2)}MB)`);
  
  // 다음 세그먼트 준비
  segmentIndex++;
  segmentStartTime = elapsedSeconds;
  
  // 청크 배열 비우기 (새로운 세그먼트 시작)
  // 주의: MediaRecorder는 계속 실행 중이므로 새 청크는 계속 추가됨
  audioChunks = [];
  
  // Background에 세그먼트 저장 완료 알림
  chrome.runtime.sendMessage({
    type: 'SEGMENT_SAVED',
    segmentIndex: segmentIndex - 1,
    totalSegments: savedSegments.length,
    elapsedSeconds,
  }).catch(() => {});
}

/**
 * 세그먼트 분할이 필요한지 확인 (20분마다)
 */
function shouldSplitSegment(): boolean {
  if (!isPremiumUser) return false;
  
  const elapsedSeconds = Math.floor((Date.now() - recordingStartTime) / 1000);
  const currentSegmentDuration = elapsedSeconds - segmentStartTime;
  
  return currentSegmentDuration >= RECORDING_LIMITS.SEGMENT_DURATION;
}

// 로그를 Background로 전송하는 헬퍼 함수
function logToBackground(message: string, data?: any) {
  const fullMessage = data !== undefined ? `${message} ${JSON.stringify(data)}` : message;
  console.log(fullMessage);
  chrome.runtime.sendMessage({
    type: 'OFFSCREEN_LOG',
    message: fullMessage,
    data: data,
  }).catch(() => {});
}

logToBackground('🟢 Offscreen document loaded');

// Background에 준비 완료 신호
setTimeout(() => {
  logToBackground('🟢 Offscreen document fully loaded and ready');
}, 100);

// Background로부터 메시지 수신
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log('Offscreen received message:', message);

  switch (message.type) {
    case 'CLEANUP':
      console.log('Offscreen: Received CLEANUP message');
      cleanup();
      sendResponse({ success: true });
      break;

    case 'SET_PREMIUM_USER':
      isPremiumUser = message.isPremium === true;
      logToBackground(`👤 Premium user: ${isPremiumUser}`);
      sendResponse({ success: true });
      break;

    case 'START_RECORDING':
      (async () => {
        logToBackground('🔴 START_RECORDING message received');
        
        // 세그먼트 관련 초기화
        segmentIndex = 0;
        segmentStartTime = 0;
        recordingStartTime = Date.now();
        savedSegments = [];
        
        // isPremiumUser는 START_RECORDING 전에 SET_PREMIUM_USER로 설정됨
        if (message.isPremium !== undefined) {
          isPremiumUser = message.isPremium === true;
        }
        logToBackground(`👤 Recording as ${isPremiumUser ? 'premium' : 'free'} user`);
        
        // 이전 녹음이 있으면 완전히 정리
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
          logToBackground('⚠️ Previous recording still active, cleaning up...');
          try {
            const prevState = mediaRecorder.state;
            logToBackground(`⚠️ Previous recorder state: ${prevState}`);
            
            if (prevState === 'recording' || prevState === 'paused') {
              logToBackground('⚠️ Stopping previous recorder...');
              mediaRecorder.stop();
              // stop 완료 대기
              await new Promise(resolve => setTimeout(resolve, 200));
            }
          } catch (e) {
            logToBackground('⚠️ Error stopping previous recorder:', e);
          }
          
          // 완전 정리
          cleanup();
          // 정리 완료 대기
          await new Promise(resolve => setTimeout(resolve, 300));
        }
        
        // 스트림이 남아있으면 정리
        if (currentStream) {
          logToBackground('⚠️ Cleaning up existing stream...');
          currentStream.getTracks().forEach(track => {
            try {
              track.stop();
            } catch (e) {
              logToBackground('⚠️ Error stopping track:', e);
            }
          });
          currentStream = null;
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // 오디오 컨텍스트가 남아있으면 정리
        if (audioContext && audioContext.state !== 'closed') {
          logToBackground('⚠️ Closing existing audio context...');
          try {
            await audioContext.close();
          } catch (e) {
            logToBackground('⚠️ Error closing audio context:', e);
          }
          audioContext = null;
          sourceNode = null;
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        try {
          logToBackground('🟢 Starting new recording...');
          await startRecording(message.streamId);
          sendResponse({ success: true });
        } catch (error: any) {
          console.error('Offscreen: ❌ Error starting recording:', error);
          logToBackground(`❌ Error: ${error.message || 'Unknown error'}`);
          sendResponse({ error: error.message || 'Error starting recording' });
        }
      })();
      return true;

    case 'STOP_RECORDING':
      (async () => {
        try {
          const blob = await stopRecording();
          if (!blob || blob.size === 0) {
            sendResponse({ error: 'No audio data recorded' });
            return;
          }
          
          // Blob을 ArrayBuffer로 변환 후 base64로 인코딩 (Chrome message passing을 위해)
          const arrayBuffer = await blob.arrayBuffer();
          console.log('Offscreen: Converting blob to ArrayBuffer, size:', arrayBuffer.byteLength);
          
          // ArrayBuffer를 Uint8Array로 변환 후 base64로 인코딩 (큰 배열 대응)
          const uint8Array = new Uint8Array(arrayBuffer);
          
          // 큰 배열을 처리하기 위해 청크 단위로 변환
          const chunkSize = 0x8000; // 32KB chunks
          let base64String = '';
          
          for (let i = 0; i < uint8Array.length; i += chunkSize) {
            const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
            base64String += String.fromCharCode.apply(null, Array.from(chunk));
          }
          
          base64String = btoa(base64String);
          
          console.log('Offscreen: ✅ Encoded to base64, length:', base64String.length);
          logToBackground(`📤 Sending audio data: ${arrayBuffer.byteLength} bytes → ${base64String.length} chars base64`);
          
          // 세그먼트가 있는 경우 (유료 사용자, 20분 이상 녹음)
          const elapsedSeconds = Math.floor((Date.now() - recordingStartTime) / 1000);
          
          // 마지막 세그먼트 추가 (현재 블롭)
          if (isPremiumUser && savedSegments.length > 0) {
            savedSegments.push({
              index: segmentIndex,
              base64: base64String,
              startTime: segmentStartTime,
              endTime: elapsedSeconds,
              size: arrayBuffer.byteLength,
            });
            
            logToBackground(`📦 Total segments: ${savedSegments.length}`);
            
            sendResponse({ 
              success: true, 
              audioDataBase64: base64String,
              audioDataSize: arrayBuffer.byteLength,
              mimeType: blob.type,
              segments: savedSegments,
              totalSegments: savedSegments.length,
            });
          } else {
            // 단일 파일 (무료 사용자 또는 20분 이하)
            sendResponse({ 
              success: true, 
              audioDataBase64: base64String,
              audioDataSize: arrayBuffer.byteLength,
              mimeType: blob.type,
            });
          }
        } catch (error: any) {
          console.error('Offscreen: Error in STOP_RECORDING:', error);
          sendResponse({ error: error.message || 'Unknown error' });
        }
      })();
      return true;

    case 'SAVE_SEGMENT':
      // 세그먼트 저장 요청 (20분마다 호출됨)
      (async () => {
        try {
          await saveCurrentSegment();
          sendResponse({ success: true, segmentIndex });
        } catch (error: any) {
          console.error('Offscreen: Error saving segment:', error);
          sendResponse({ error: error.message });
        }
      })();
      return true;

  }
});

async function startRecording(streamId: string): Promise<void> {
  logToBackground('🔴 Starting recording with streamId:', streamId);
  
  // 중복 정리 방지: 이미 메시지 핸들러에서 정리했지만, 혹시 모를 경우 대비
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    logToBackground('⚠️ WARNING: mediaRecorder still exists! Cleaning up...');
    try {
      if (mediaRecorder.state === 'recording' || mediaRecorder.state === 'paused') {
        mediaRecorder.stop();
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    } catch (e) {
      logToBackground('⚠️ Error stopping existing recorder:', e);
    }
    cleanup();
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  // 추가 안전 정리
  if (currentStream) {
    logToBackground('⚠️ WARNING: currentStream still exists! Cleaning up...');
    currentStream.getTracks().forEach(track => {
      try {
        track.stop();
      } catch (e) {
        logToBackground('⚠️ Error stopping track:', e);
      }
    });
    currentStream = null;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  if (audioContext && audioContext.state !== 'closed') {
    logToBackground('⚠️ WARNING: audioContext still exists! Cleaning up...');
    try {
      await audioContext.close();
    } catch (e) {
      logToBackground('⚠️ Error closing audio context:', e);
    }
    audioContext = null;
    sourceNode = null;
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  try {
    // getUserMedia를 사용하여 스트림 획득
    // 재시도 로직 추가 (Chrome API가 이전 캡처 상태를 완전히 해제하지 못할 수 있음)
    let stream: MediaStream | null = null;
    let retries = 3;
    let lastError: Error | null = null;
    
    while (retries > 0 && !stream) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            mandatory: {
              chromeMediaSource: 'tab',
              chromeMediaSourceId: streamId,
            },
          } as any,
        });
        
        logToBackground('🟢 Got media stream, active:', stream.active);
        logToBackground('🟢 Stream tracks:', stream.getTracks().length);
        currentStream = stream;
        break; // 성공하면 루프 종료
      } catch (error: any) {
        lastError = error;
        logToBackground(`⚠️ Failed to get media stream (attempt ${4 - retries}/3): ${error.message}`);
        
        // "tab capture" 관련 에러인 경우 재시도
        if (error.message.includes('tab capture') || 
            error.message.includes('Cannot capture') ||
            error.name === 'NotAllowedError' ||
            error.name === 'NotFoundError') {
          retries--;
          if (retries > 0) {
            logToBackground(`Retrying in 500ms... (${retries} attempts left)`);
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        } else {
          // 다른 에러는 즉시 반환
          throw error;
        }
      }
    }
    
    if (!stream) {
      const errorMsg = lastError?.message || '스트림을 가져올 수 없습니다.';
      logToBackground(`❌ Failed to get media stream after all retries: ${errorMsg}`);
      throw new Error(`Error starting tab capture: ${errorMsg}. 이전 녹음이 완전히 종료되지 않았을 수 있습니다.`);
    }

    // 🔊 오디오를 스피커로도 출력 (녹음하면서 소리 들리게)
    try {
      audioContext = new AudioContext();
      sourceNode = audioContext.createMediaStreamSource(stream);
      
      // 스피커로 연결
      sourceNode.connect(audioContext.destination);
      logToBackground('🔊 Audio connected to speakers');
    } catch (audioError) {
      logToBackground('⚠️ Failed to connect audio to speakers:', audioError);
      // 스피커 연결 실패해도 녹음은 계속 진행
    }

    // ===== Realtime API용 PCM 오디오 스트림 시작 =====
    // 별도의 AudioContext를 사용하여 24kHz PCM 데이터 추출
    startPCMAudioStream(stream);

    // MediaRecorder 생성 (더 작은 간격으로 데이터 수집)
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
      ? 'audio/webm;codecs=opus' 
      : 'audio/webm';
    
    console.log('Offscreen: Using mimeType:', mimeType);
    
    mediaRecorder = new MediaRecorder(stream, {
      mimeType: mimeType,
      audioBitsPerSecond: 64000, // 64kbps (STT 인식 가능한 품질 유지)
    });

    audioChunks = [];

    mediaRecorder.ondataavailable = async (event) => {
      if (event.data && event.data.size > 0) {
        audioChunks.push(event.data);
        
        // 현재 총 크기 계산
        const totalSize = audioChunks.reduce((sum, chunk) => sum + chunk.size, 0);
        
        // 24MB 제한 체크
        if (totalSize >= MAX_AUDIO_FILE_SIZE) {
          logToBackground(`⚠️ Maximum file size reached: ${(totalSize / 1024 / 1024).toFixed(2)}MB (limit: ${(MAX_AUDIO_FILE_SIZE / 1024 / 1024).toFixed(2)}MB)`);
          
          // 자동으로 녹음 정지
          if (mediaRecorder && mediaRecorder.state === 'recording') {
            logToBackground('🛑 Auto-stopping recording due to size limit');
            mediaRecorder.stop();
            
            // Background에 최대 크기 도달 알림
            chrome.runtime.sendMessage({
              type: 'RECORDING_MAX_SIZE_REACHED',
              totalSize: totalSize,
            }).catch(() => {});
          }
        }
        
        // ===== 세그먼트 분할 체크 (유료 사용자, 20분마다) =====
        if (shouldSplitSegment()) {
          logToBackground('📦 Splitting segment at 20 minutes...');
          try {
            await saveCurrentSegment();
          } catch (error) {
            console.warn('[Segment] Error saving segment:', error);
            // 세그먼트 저장 실패해도 녹음은 계속됨
          }
        }
        
        // Note: Realtime API용 PCM 오디오는 별도의 ScriptProcessorNode에서 처리됨
      }
    };

    mediaRecorder.onstart = () => {
      logToBackground('✅ MediaRecorder onstart triggered!');
      if (mediaRecorder) {
        logToBackground('📊 State:', mediaRecorder.state);
        logToBackground('📊 MimeType:', mediaRecorder.mimeType);
      }
      logToBackground('📊 Stream active:', stream.active);
      logToBackground('📊 Stream tracks:', stream.getTracks().length);
      
      stream.getTracks().forEach((track, i) => {
        logToBackground(`📊 Track ${i}: kind=${track.kind}, enabled=${track.enabled}, muted=${track.muted}, readyState=${track.readyState}`);
      });
      
      isManualStop = false;
      finalBlob = null;
      audioChunks = [];
      logToBackground('✅ Recording initialized, waiting for data...');
    };

    mediaRecorder.onstop = () => {
      console.log('Offscreen: ⚠️ MediaRecorder stopped (isManualStop:', isManualStop, ')');
      console.log('Offscreen: audioChunks at stop:', audioChunks.length);
      
      // 녹음 데이터를 즉시 Blob으로 저장
      if (audioChunks.length > 0) {
        finalBlob = new Blob(audioChunks, { type: mimeType });
        console.log('Offscreen: ✅ Saved blob, size:', finalBlob.size);
      } else {
        console.error('Offscreen: ❌ No audio chunks to save!');
      }
    };

    mediaRecorder.onerror = (event: any) => {
      console.error('Offscreen: ❌ MediaRecorder error:', event.error);
      chrome.runtime.sendMessage({
        type: 'RECORDING_ERROR',
        error: event.error?.message || 'Unknown error',
      }).catch(() => {});
    };

    // 100ms마다 데이터 수집 (더 자주!)
    console.log('Offscreen: Starting MediaRecorder with 100ms timeslice...');
    mediaRecorder.start(100);
    
    console.log('Offscreen: MediaRecorder.start() called');
    if (mediaRecorder) {
      console.log('Offscreen: State after start:', mediaRecorder.state);
    }
    
    // 1초 후 상태 재확인
    setTimeout(() => {
      if (mediaRecorder) {
        console.log('Offscreen: [1sec check] State:', mediaRecorder.state);
        console.log('Offscreen: [1sec check] Chunks collected:', audioChunks.length);
      }
    }, 1000);
  } catch (error) {
    console.error('Offscreen: Error starting recording:', error);
    throw error;
  }
}

async function stopRecording(): Promise<Blob> {
  logToBackground('🔴 stopRecording called');
  logToBackground('🔴 mediaRecorder exists:', !!mediaRecorder);
  logToBackground('🔴 mediaRecorder state:', mediaRecorder?.state);
  logToBackground('🔴 audioChunks count BEFORE stop:', audioChunks.length);
  
  // 현재 chunks 백업
  const chunksBeforeStop = [...audioChunks];
  const totalSizeBeforeStop = chunksBeforeStop.reduce((sum, chunk) => sum + chunk.size, 0);
  logToBackground(`🔴 Total size BEFORE stop: ${(totalSizeBeforeStop / 1024 / 1024).toFixed(2)}MB`);
  
  // 24MB 제한 체크
  if (totalSizeBeforeStop > MAX_AUDIO_FILE_SIZE) {
    logToBackground(`⚠️ File size exceeds limit: ${(totalSizeBeforeStop / 1024 / 1024).toFixed(2)}MB (limit: ${(MAX_AUDIO_FILE_SIZE / 1024 / 1024).toFixed(2)}MB)`);
    throw new Error(`녹음 파일 크기가 24MB를 초과했습니다 (${(totalSizeBeforeStop / 1024 / 1024).toFixed(2)}MB). 녹음 시간을 줄여주세요.`);
  }
  
  return new Promise((resolve, reject) => {
    // mediaRecorder가 없으면 에러
    if (!mediaRecorder) {
      logToBackground('❌ No mediaRecorder!');
      
      // audioChunks가 있으면 그것이라도 사용
      if (chunksBeforeStop.length > 0) {
        logToBackground('✅ But we have chunks, creating blob anyway');
        const blob = new Blob(chunksBeforeStop, { type: 'audio/webm;codecs=opus' });
        logToBackground('✅ Emergency blob created, size:', blob.size);
        cleanup();
        resolve(blob);
        return;
      }
      
      cleanup();
      reject(new Error('No recording in progress'));
      return;
    }
    
    const currentState = mediaRecorder.state;
    logToBackground('🔴 Current state:', currentState);
    
    // inactive 상태: 이미 정지됨
    if (currentState === 'inactive') {
      logToBackground('⚠️ MediaRecorder already inactive');
      
      if (chunksBeforeStop.length === 0) {
        logToBackground('❌ No chunks!');
        cleanup();
        reject(new Error('No audio data recorded'));
        return;
      }
      
      const blob = new Blob(chunksBeforeStop, { type: 'audio/webm;codecs=opus' });
      logToBackground('✅ Created blob from chunks, size:', blob.size);
      cleanup();
      resolve(blob);
      return;
    }
    
    // paused 상태는 이제 없지만, 혹시 모를 상황 대비
    if (currentState === 'paused') {
      logToBackground('⏸️ MediaRecorder is paused, resuming before stop...');
      try {
        mediaRecorder.resume();
        logToBackground('✅ Resumed');
        // resume 후 상태 전환이 완료될 때까지 대기 (Promise 내부이므로 Promise로 처리)
        new Promise<void>((resolve) => {
          setTimeout(() => {
            if (mediaRecorder && mediaRecorder.state === 'paused') {
              logToBackground('⚠️ Still paused after resume, forcing stop');
            }
            resolve();
          }, 100);
        }).catch(() => {});
      } catch (e) {
        logToBackground('⚠️ Error resuming:', e);
      }
    }

    // 정상적으로 정지
    isManualStop = true;
    
    // stop 전에 현재까지의 chunks 저장
    const chunksSnapshot = [...audioChunks];
    
    const onStop = () => {
      logToBackground('🟢 onStop handler triggered');
      // stop 후 마지막 chunk가 추가되었을 수 있으므로 현재 chunks 사용
      const finalChunks = audioChunks.length > chunksSnapshot.length ? audioChunks : chunksSnapshot;
      
      if (finalChunks.length === 0) {
        logToBackground('❌ No chunks in onStop!');
        cleanup();
        reject(new Error('No audio data recorded'));
        return;
      }
      
      const totalSize = finalChunks.reduce((sum, chunk) => sum + chunk.size, 0);
      
      // chunks를 깊은 복사로 저장 (cleanup 전에)
      const chunksForBlob = finalChunks.map(chunk => new Blob([chunk], { type: chunk.type || 'audio/webm' }));
      
      const blob = new Blob(chunksForBlob, { type: 'audio/webm;codecs=opus' });
      logToBackground(`✅✅✅ Final blob created, size: ${(blob.size / 1024 / 1024).toFixed(2)}MB`);
      
      // 24MB 제한 최종 체크
      if (blob.size > MAX_AUDIO_FILE_SIZE) {
        logToBackground(`❌ Blob size exceeds limit: ${(blob.size / 1024 / 1024).toFixed(2)}MB (limit: ${(MAX_AUDIO_FILE_SIZE / 1024 / 1024).toFixed(2)}MB)`);
        cleanup();
        reject(new Error(`녹음 파일 크기가 24MB를 초과했습니다 (${(blob.size / 1024 / 1024).toFixed(2)}MB). 녹음 시간을 줄여주세요.`));
        return;
      }
      
      if (blob.size < 1000) {
        logToBackground(`⚠️ Blob too small! Expected chunks: ${finalChunks.length}, Total size: ${totalSize}`);
        cleanup();
        reject(new Error(`Blob too small: ${blob.size} bytes. Expected at least 1000 bytes.`));
        return;
      }
      
      // cleanup은 blob을 resolve한 후에
      setTimeout(() => {
        cleanup();
      }, 100);
      
      resolve(blob);
    };

    mediaRecorder.onstop = onStop;
    
    try {
      logToBackground('🟢 Calling mediaRecorder.stop()');
      mediaRecorder.stop();
      
      // stop() 후 약간의 지연을 주어 마지막 chunk 수집 대기 (로그 제거)
    } catch (error) {
      logToBackground('❌ Error calling stop:', error);
      
      // 에러 발생해도 chunks가 있으면 blob 생성
      if (chunksSnapshot.length > 0) {
        logToBackground('✅ Error but chunks exist, creating blob');
        const blob = new Blob(chunksSnapshot, { type: 'audio/webm;codecs=opus' });
        cleanup();
        resolve(blob);
      } else {
        cleanup();
        reject(error);
      }
    }
  });
}

function cleanup() {
  console.log('Offscreen: Cleaning up...');
  
  // ===== Realtime API용 PCM 스트림 정리 =====
  stopPCMAudioStream();
  
  // 오디오 컨텍스트 정리 (스피커 출력용)
  if (sourceNode) {
    try {
      sourceNode.disconnect();
    } catch (e) {
      console.warn('Error disconnecting source node:', e);
    }
    sourceNode = null;
  }
  
  if (audioContext) {
    try {
      audioContext.close();
    } catch (e) {
      console.warn('Error closing audio context:', e);
    }
    audioContext = null;
  }
  
  // 스트림 정지
  if (currentStream) {
    currentStream.getTracks().forEach((track) => {
      try {
        track.stop();
      } catch (e) {
        console.warn('Error stopping track:', e);
      }
    });
    currentStream = null;
  }
  
  mediaRecorder = null;
  audioChunks = [];
  finalBlob = null;
  isManualStop = false;
  
  console.log('Offscreen: Cleanup complete');
}

