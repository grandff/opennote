/// <reference types="chrome"/>

import { MESSAGE_TYPES, MAX_RECORDING_DURATION, MAX_AUDIO_FILE_SIZE, BACKEND_API_URL, EXTENSION_API_KEY } from '@/utils/constants';
import { saveAudioData } from '@/utils/indexedDB';

// Chrome API 상세 확인
console.log('=== Background Script Loaded ===');
console.log('Chrome object exists:', typeof chrome !== 'undefined');
console.log('Chrome APIs available:', {
  tabCapture: typeof chrome?.tabCapture,
  'tabCapture.capture': typeof chrome?.tabCapture?.capture,
  runtime: typeof chrome?.runtime,
  storage: typeof chrome?.storage,
});

// tabCapture 전체 확인
if (chrome?.tabCapture) {
  console.log('chrome.tabCapture methods:', Object.keys(chrome.tabCapture));
} else {
  console.error('❌ chrome.tabCapture is undefined!');
  console.log('Available chrome APIs:', Object.keys(chrome || {}));
}

// 녹음 상태 관리
let recordingStream: MediaStream | null = null;
let recordingStartTime: number = 0;
let isRecording: boolean = false;
let maxDurationTimer: NodeJS.Timeout | null = null;
let lastStoppedRecording: {
  storageKey: string;
  audioBlobSize: number;
  audioBlobType: string;
  timestamp: number;
} | null = null;

// 메시지 리스너
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log('Background received message:', message);

    // Offscreen 로그 받기
    if (message.type === 'OFFSCREEN_LOG') {
      console.log(`[OFFSCREEN] ${message.message}`, message.data || '');
      return;
    }

    // 최대 크기 도달 알림
    if (message.type === 'RECORDING_MAX_SIZE_REACHED') {
      console.log(`[OFFSCREEN] Maximum file size reached: ${message.totalSize ? (message.totalSize / 1024 / 1024).toFixed(2) + 'MB' : 'unknown'}`);
      // Offscreen에서 이미 정지했으므로 Background 상태만 업데이트
      if (isRecording) {
        console.log('Background: Recording reached max size, cleaning up...');
        cleanup();
      }
      return;
    }

  switch (message.type) {
    case MESSAGE_TYPES.START_RECORDING:
      handleStartRecording(message.payload.streamId)
        .then(() => sendResponse({ success: true }))
        .catch((error) => sendResponse({ error: error.message }));
      return true; // 비동기 응답을 위해 true 반환

    case MESSAGE_TYPES.STOP_RECORDING:
      (async () => {
        let responseSent = false;
        
        try {
          // 중복 호출 체크: 최근 3초 이내에 정지한 녹음이 있으면 그것을 반환
          if (lastStoppedRecording && (Date.now() - lastStoppedRecording.timestamp) < 3000) {
            console.log('Background: ⚠️ Duplicate STOP_RECORDING detected, returning last stopped recording');
            console.log('Background: Last stopped recording key:', lastStoppedRecording.storageKey);
            
            const finalResponse = Object.assign(Object.create(null), {
              success: true,
              storageKey: lastStoppedRecording.storageKey,
              audioBlobSize: lastStoppedRecording.audioBlobSize,
              audioBlobType: lastStoppedRecording.audioBlobType,
            });
            
            sendResponse(finalResponse);
            responseSent = true;
            console.log('Background: ✅ Sent duplicate response with last storageKey:', lastStoppedRecording.storageKey);
            return;
          }
          
          const result = await handleStopRecording();
          
          console.log('Background: Got result from handleStopRecording');
          console.log('Background: Result type:', typeof result);
          console.log('Background: Result keys:', result ? Object.keys(result) : 'null/undefined');
          
          // handleStopRecording이 { audioDataBase64, audioDataSize, mimeType } 객체를 반환
          if (!result || typeof result !== 'object' || !result.audioDataBase64) {
            throw new Error(`Invalid result from handleStopRecording: ${JSON.stringify(result).substring(0, 200)}`);
          }
          
          const { audioDataBase64, audioDataSize, mimeType } = result;
          
          console.log('Background: Received audioDataBase64, length:', audioDataBase64?.length);
          console.log('Background: Expected size:', audioDataSize, 'bytes', `(${(audioDataSize / 1024 / 1024).toFixed(2)}MB)`);
          console.log('Background: mimeType:', mimeType);
          
          // 24MB 제한 체크
          if (audioDataSize > MAX_AUDIO_FILE_SIZE) {
            console.error(`Background: ❌ Audio file size exceeds limit: ${(audioDataSize / 1024 / 1024).toFixed(2)}MB (limit: ${(MAX_AUDIO_FILE_SIZE / 1024 / 1024).toFixed(2)}MB)`);
            throw new Error(`녹음 파일 크기가 24MB를 초과했습니다 (${(audioDataSize / 1024 / 1024).toFixed(2)}MB). 녹음 시간을 줄여주세요.`);
          }
          
          // IndexedDB에 저장
          const storageKey = `recording_${Date.now()}`;
          
          try {
            console.log('Background: Saving to IndexedDB, key:', storageKey, 'size:', `${(audioDataSize / 1024 / 1024).toFixed(2)}MB`);
            await saveAudioData(
              storageKey,
              audioDataBase64,
              audioDataSize,
              mimeType
            );
            
            console.log('Background: ✅ Saved to IndexedDB, key:', storageKey);
            console.log('Background: ✅ IndexedDB data saved successfully');
          } catch (dbError: any) {
            console.error('Background: ❌ Failed to save to IndexedDB:', dbError);
            throw new Error(`IndexedDB error: ${dbError.message || 'Failed to save audio data'}`);
          }
          
          // 최근 정지한 녹음 정보 저장 (중복 호출 대응)
          lastStoppedRecording = {
            storageKey: storageKey,
            audioBlobSize: audioDataSize,
            audioBlobType: mimeType,
            timestamp: Date.now(),
          };
          
          // 명시적으로 새 객체 생성 - Object.create로 프로토타입 없는 순수 객체
          const finalResponse = Object.assign(Object.create(null), {
            success: true,
            storageKey: storageKey,
            audioBlobSize: audioDataSize,
            audioBlobType: mimeType,
          });
          
          // 응답 객체 검증
          if ('audioDataBase64' in finalResponse || 'audioBlobBase64' in finalResponse) {
            console.error('Background: ❌ CRITICAL: Response contains base64 data!');
            throw new Error('Response contains base64 data. This should never happen.');
          }
          
          console.log('Background: ✅ Final response prepared:', {
            hasStorageKey: !!finalResponse.storageKey,
            storageKey: finalResponse.storageKey,
            audioBlobSize: finalResponse.audioBlobSize,
            keys: Object.keys(finalResponse),
          });
          
          if (responseSent) {
            console.error('Background: ❌ Response already sent! Skipping duplicate response.');
            return;
          }
          
          // sendResponse 호출 - Chrome이 자동으로 Popup에 전달
          sendResponse(finalResponse);
          responseSent = true;
          console.log('Background: ✅ sendResponse called with storageKey:', storageKey);
          console.log('Background: ✅ Response object:', JSON.stringify(finalResponse));
        } catch (error: any) {
          console.error('Background: ❌ Error in STOP_RECORDING handler:', error);
          console.error('Background: ❌ Error stack:', error.stack);
          
          if (!responseSent) {
            sendResponse({ 
              success: false,
              error: error.message || 'Unknown error occurred' 
            });
            responseSent = true;
          }
        }
      })();
      return true; // 비동기 응답을 위해 true 반환

    case MESSAGE_TYPES.GET_RECORDING_STATUS:
      sendResponse({
        isRecording,
        duration: getCurrentDuration(),
      });
      break;

    case 'GET_ACTIVE_TAB':
      // 활성 탭 정보 가져오기
      chrome.tabs.query({ active: true, currentWindow: true })
        .then((tabs) => {
          const tab = tabs[0];
          sendResponse({ 
            success: true, 
            tabId: tab?.id,
            url: tab?.url,
          });
        })
        .catch((error) => {
          sendResponse({ error: error.message });
        });
      return true; // 비동기 응답

    case 'START_RECORDING_WITH_TAB':
      (async () => {
        try {
          console.log('Background: START_RECORDING_WITH_TAB received');
          
          // 활성 탭 찾기
          let tab: chrome.tabs.Tab | undefined;
          
          try {
            // 먼저 currentWindow에서 찾기
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            tab = tabs[0];
            
            // 실패하면 모든 창에서 찾기
            if (!tab || !tab.id) {
              const allTabs = await chrome.tabs.query({ active: true });
              // URL이 있는 일반 웹페이지 탭 찾기
              tab = allTabs.find(t => 
                t.id && 
                t.url && 
                !t.url.startsWith('chrome://') && 
                !t.url.startsWith('chrome-extension://') &&
                !t.url.startsWith('edge://')
              ) || allTabs[0];
            }
          } catch (queryError: any) {
            console.error('Background: Tab query failed:', queryError);
            sendResponse({ 
              success: false, 
              error: `활성 탭을 찾을 수 없습니다: ${queryError.message}` 
            });
            return;
          }

          if (!tab || !tab.id) {
            sendResponse({ 
              success: false, 
              error: '활성 탭을 찾을 수 없습니다. 일반 웹페이지(YouTube, Spotify 등)를 열어주세요.' 
            });
            return;
          }

          // 특수 페이지 체크
          if (tab.url?.startsWith('chrome://') || 
              tab.url?.startsWith('edge://') ||
              tab.url?.startsWith('chrome-extension://')) {
            sendResponse({ 
              success: false, 
              error: '이 페이지에서는 녹음할 수 없습니다. 일반 웹페이지(YouTube, Spotify 등)로 이동해주세요.' 
            });
            return;
          }

          console.log('Background: Found active tab:', tab.id, tab.url);

          // getMediaStreamId 호출 (Background에서 호출하면 activeTab 권한이 활성화됨)
          let streamId: string | null = null;
          let retries = 3;
          let lastError: Error | null = null;
          
          while (retries > 0 && !streamId) {
            try {
              streamId = await new Promise<string>((resolve, reject) => {
                chrome.tabCapture.getMediaStreamId(
                  { targetTabId: tab.id },
                  (id) => {
                    if (chrome.runtime.lastError) {
                      const error = new Error(chrome.runtime.lastError.message);
                      reject(error);
                      return;
                    }
                    if (!id) {
                      reject(new Error('스트림 ID를 가져올 수 없습니다.'));
                      return;
                    }
                    resolve(id);
                  }
                );
              });
              
              console.log('Background: Got stream ID:', streamId);
              break;
            } catch (error: any) {
              lastError = error;
              console.warn(`Background: Failed to get stream ID (attempt ${4 - retries}/3):`, error.message);
              
              // "tab capture" 또는 "activeTab" 관련 에러인 경우 재시도
              if (error.message.includes('tab capture') || 
                  error.message.includes('Cannot capture') ||
                  error.message.includes('activeTab') ||
                  error.message.includes('Extension context invalidated')) {
                retries--;
                if (retries > 0) {
                  console.log(`Background: Retrying in 500ms... (${retries} attempts left)`);
                  await new Promise(resolve => setTimeout(resolve, 500));
                }
              } else {
                // 다른 에러는 즉시 반환
                throw error;
              }
            }
          }
          
          if (!streamId) {
            const errorMsg = lastError?.message || '스트림 ID를 가져올 수 없습니다.';
            sendResponse({ 
              success: false, 
              error: `녹음 시작 실패: ${errorMsg}` 
            });
            return;
          }

          // 녹음 시작
          try {
            await handleStartRecording(streamId);
            sendResponse({ 
              success: true,
              streamId: streamId
            });
          } catch (error: any) {
            console.error('Background: Error starting recording:', error);
            sendResponse({ 
              success: false, 
              error: error.message || '녹음 시작에 실패했습니다.' 
            });
          }
        } catch (error: any) {
          console.error('Background: Error in START_RECORDING_WITH_TAB:', error);
          sendResponse({ 
            success: false, 
            error: error.message || '알 수 없는 오류가 발생했습니다.' 
          });
        }
      })();
      return true; // 비동기 응답

    case MESSAGE_TYPES.TRANSCRIBE_AUDIO:
      (async () => {
        try {
          // 백엔드 API 설정 확인
          if (!BACKEND_API_URL || BACKEND_API_URL === '') {
            throw new Error('백엔드 API URL이 설정되지 않았습니다. .env 파일에 VITE_BACKEND_API_URL을 설정하고 다시 빌드해주세요.');
          }
          
          if (!EXTENSION_API_KEY || EXTENSION_API_KEY === '') {
            throw new Error('Extension API 키가 설정되지 않았습니다. .env 파일에 VITE_EXTENSION_API_KEY를 설정하고 다시 빌드해주세요.');
          }
          
          const { audioBase64, audioSize, mimeType, language } = message.payload;
          
          console.log('Background: TRANSCRIBE_AUDIO received, size:', audioSize);
          console.log('Background: Backend URL:', BACKEND_API_URL);
          
          // 진행률 콜백은 Popup에서 처리하므로, 여기서는 최종 결과만 반환
          // 진행률은 서버에서 처리되고 클라이언트는 최종 텍스트만 받음
          
          // 요청 본문 구성 (EXTENSION_API_GUIDE.md 스펙에 맞춤)
          const requestBody = {
            audio: {
              data: audioBase64,
              mimeType: mimeType || 'audio/webm;codecs=opus',
              size: audioSize,
            },
            language: language || 'ko', // 기본값: 한국어
            stream: true,
          };
          
          console.log('Background: Calling backend API:', `${BACKEND_API_URL}/api/v1/transcribe`);
          
          // 백엔드 프록시 서버로 요청
          const response = await fetch(`${BACKEND_API_URL}/api/v1/transcribe`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${EXTENSION_API_KEY}`,
            },
            body: JSON.stringify(requestBody),
          });
          
          // 응답 확인
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ 
              error: `HTTP ${response.status}: ${response.statusText}`,
              code: 'HTTP_ERROR'
            }));
            
            let errorMessage = errorData.error || `API 호출 실패: ${response.status}`;
            
            // 에러 코드별 사용자 친화적 메시지
            if (response.status === 401) {
              errorMessage = '인증에 실패했습니다. API 키를 확인하세요.';
            } else if (response.status === 400) {
              errorMessage = errorData.error || '요청 형식이 올바르지 않습니다.';
            } else if (response.status === 429) {
              errorMessage = '요청 한도를 초과했습니다. 잠시 후 다시 시도하세요.';
            } else if (response.status >= 500) {
              errorMessage = '서버 오류가 발생했습니다. 잠시 후 다시 시도하세요.';
            }
            
            throw new Error(errorMessage);
          }
          
          // 성공 응답 파싱
          const result = await response.json();
          
          if (!result.success || !result.text) {
            throw new Error(result.error || '음성 변환에 실패했습니다.');
          }
          
          console.log('Background: ✅ Transcription completed, text length:', result.text.length);
          
          sendResponse({
            success: true,
            text: result.text,
            progress: {
              status: 'completed',
              progress: 100,
              message: '완료',
            },
          });
        } catch (error: any) {
          console.error('Background: ❌ Transcription error:', error);
          
          // 에러 메시지 추출
          let errorMessage = error.message || '음성 변환 중 오류가 발생했습니다.';
          
          // 네트워크 오류 처리
          if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
            errorMessage = '네트워크 연결을 확인해주세요. 백엔드 서버가 실행 중인지 확인하세요.';
          }
          
          sendResponse({
            success: false,
            error: errorMessage,
            progress: {
              status: 'error',
              progress: 0,
              error: errorMessage,
            },
          });
        }
      })();
      return true; // 비동기 응답

    default:
      sendResponse({ error: 'Unknown message type' });
  }
});

/**
 * Offscreen document 생성 및 준비 대기
 */
async function setupOffscreenDocument() {
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT' as chrome.runtime.ContextType],
  });

  if (existingContexts.length > 0) {
    console.log('Offscreen document already exists');
    return;
  }

  await chrome.offscreen.createDocument({
    url: 'src/offscreen/offscreen.html',
    reasons: ['USER_MEDIA' as chrome.offscreen.Reason],
    justification: 'Recording audio from browser tab',
  });

  console.log('Offscreen document created');
  
  // Offscreen document가 완전히 로드될 때까지 대기
  await new Promise(resolve => setTimeout(resolve, 500));
  console.log('Offscreen document ready');
}

/**
 * 녹음 시작 (Manifest V3 방식 - Offscreen Document 사용)
 */
async function handleStartRecording(streamId: string): Promise<void> {
  try {
    console.log('Starting recording with stream ID:', streamId);

    // ========== 1단계: 기존 녹음 완전 정리 ==========
    console.log('Step 1: Cleaning up any existing recording...');
    
    if (isRecording) {
      console.warn('⚠️ Recording already in progress, forcing stop...');
      try {
        // Offscreen에 정지 요청
        await chrome.runtime.sendMessage({ type: 'STOP_RECORDING' }).catch((e) => {
          console.warn('Error sending STOP_RECORDING:', e);
        });
        // 정지 완료 대기
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.warn('Error stopping previous recording:', error);
      }
    }

    // 강제 cleanup (모든 상태 초기화)
    cleanup();
    
    // ========== 2단계: 기존 Offscreen Document 완전 제거 ==========
    console.log('Step 2: Removing existing offscreen document...');
    
    let existingContexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT' as chrome.runtime.ContextType],
    });

    if (existingContexts.length > 0) {
      console.log(`Found ${existingContexts.length} existing offscreen document(s), closing...`);
      
      try {
        // Offscreen에 cleanup 메시지 전송
        await chrome.runtime.sendMessage({ type: 'CLEANUP' }).catch(() => {});
        // cleanup 처리 대기
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // 문서 제거 시도
        await chrome.offscreen.closeDocument().catch((e) => {
          console.warn('Error closing offscreen document:', e);
        });
        
        // 문서 제거 완료 대기
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // 제거 확인
        existingContexts = await chrome.runtime.getContexts({
          contextTypes: ['OFFSCREEN_DOCUMENT' as chrome.runtime.ContextType],
        });
        
        if (existingContexts.length > 0) {
          console.warn(`⚠️ Offscreen document still exists after close attempt, retrying...`);
          // 재시도
          await chrome.offscreen.closeDocument().catch(() => {});
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (error) {
        console.warn('Error closing existing offscreen document:', error);
      }
    }

    // 최종 확인: 정말 모두 제거되었는지
    existingContexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT' as chrome.runtime.ContextType],
    });
    
    if (existingContexts.length > 0) {
      console.error(`❌ Still ${existingContexts.length} offscreen document(s) exist!`);
      throw new Error('Cannot start new recording: previous offscreen document still exists');
    }

    console.log('✅ All existing offscreen documents removed');

    // ========== 3단계: 추가 대기 (Chrome API 정리 완료 대기) ==========
    console.log('Step 3: Waiting for Chrome API cleanup...');
    await new Promise(resolve => setTimeout(resolve, 800)); // 더 긴 대기 시간

    // ========== 4단계: 새 Offscreen Document 생성 ==========
    console.log('Step 4: Creating new offscreen document...');
    await setupOffscreenDocument();
    
    // Offscreen document가 완전히 준비될 때까지 추가 대기
    await new Promise(resolve => setTimeout(resolve, 300));

    // ========== 5단계: 녹음 시작 요청 ==========
    console.log('Step 5: Sending START_RECORDING to offscreen with streamId:', streamId);
    
    // 재시도 로직 추가
    let response = null;
    let retries = 5; // 재시도 횟수 증가
    
    while (retries > 0 && !response?.success) {
      try {
        response = await chrome.runtime.sendMessage({
          type: 'START_RECORDING',
          streamId,
        });
        
        console.log(`Attempt ${6 - retries}/5 - Response from offscreen START_RECORDING:`, response);
        
        if (response?.success) {
          break;
        }
        
        if (response?.error) {
          console.warn(`Retry ${6 - retries}/5: ${response.error}`);
          // "tab capture" 관련 에러인 경우 더 긴 대기 시간
          const waitTime = response.error.includes('tab capture') ? 800 : 300;
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      } catch (error: any) {
        console.error(`Error sending message to offscreen (attempt ${6 - retries}/5):`, error);
        const waitTime = error.message?.includes('tab capture') ? 800 : 300;
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
      
      retries--;
    }

    if (!response?.success) {
      const errorMsg = response?.error || 'Failed to start recording in offscreen document';
      console.error('❌ Failed to start recording after all retries:', errorMsg);
      
      // 실패 시 cleanup
      try {
        await chrome.offscreen.closeDocument().catch(() => {});
      } catch (e) {
        console.warn('Error closing offscreen document after failure:', e);
      }
      cleanup();
      
      throw new Error(errorMsg);
    }

    isRecording = true;
    recordingStartTime = Date.now();
    
    // 새 녹음 시작 시 이전 정지 기록 클리어 (5분 이상 지난 경우만)
    if (lastStoppedRecording && (Date.now() - lastStoppedRecording.timestamp) > 5 * 60 * 1000) {
      lastStoppedRecording = null;
    }

    console.log('✅ Recording started successfully in background');

    // 최대 녹음 시간 타이머 설정 (60분)
    maxDurationTimer = setTimeout(() => {
      console.log('Max recording duration reached');
      handleStopRecording();
    }, MAX_RECORDING_DURATION * 1000);
  } catch (error) {
    console.error('❌ Error starting recording:', error);
    cleanup();
    
    // 에러 메시지 개선
    if (error instanceof Error && error.message.includes('tab capture')) {
      throw new Error('Error starting tab capture. Please close any other recording sessions and try again.');
    }
    
    throw error;
  }
}

/**
 * 녹음 정지
 */
async function handleStopRecording(): Promise<{
  audioDataBase64: string;
  audioDataSize: number;
  mimeType: string;
}> {
  console.log('Background: handleStopRecording called, isRecording:', isRecording);
  
  // isRecording 플래그에 의존하지 않고 항상 Offscreen에 요청
  // pause/resume 과정에서 플래그가 잘못 설정될 수 있음
  // Offscreen의 실제 상태를 확인하도록 함

  try {
    // Offscreen document에 정지 요청
    console.log('Background: Sending STOP_RECORDING message to offscreen...');
    const response = await chrome.runtime.sendMessage({ type: 'STOP_RECORDING' });
    console.log('Background: Got response from offscreen:', {
      hasResponse: !!response,
      hasError: !!response?.error,
      hasAudioData: !!response?.audioDataBase64,
      responseKeys: response ? Object.keys(response) : [],
    });
    
    if (response?.error) {
      throw new Error(response.error);
    }

    if (!response?.audioDataBase64) {
      console.error('Background: ❌ No audioDataBase64 in response');
      console.error('Background: ❌ Full response:', JSON.stringify(response).substring(0, 500));
      throw new Error('No audio data received from offscreen');
    }

    console.log('Background: ✅ Received audioDataBase64, length:', response.audioDataBase64?.length);
    console.log('Background: ✅ Expected size:', response.audioDataSize);
    console.log('Background: ✅ mimeType:', response.mimeType);

    // base64 데이터를 그대로 반환 (디코딩/인코딩 불필요)
    cleanup();
    
    return {
      audioDataBase64: response.audioDataBase64,
      audioDataSize: response.audioDataSize,
      mimeType: response.mimeType,
    };
  } catch (error) {
    console.error('Background: ❌ Error in handleStopRecording:', error);
    cleanup();
    throw error;
  }
}

/**
 * 현재 녹음 시간 계산 (초)
 */
function getCurrentDuration(): number {
  if (!isRecording) return 0;
  
  return Math.floor((Date.now() - recordingStartTime) / 1000);
}

/**
 * 정리
 */
function cleanup(): void {
  if (recordingStream) {
    recordingStream.getTracks().forEach((track) => track.stop());
    recordingStream = null;
  }

  if (maxDurationTimer) {
    clearTimeout(maxDurationTimer);
    maxDurationTimer = null;
  }

  isRecording = false;
  recordingStartTime = 0;
  
  // lastStoppedRecording은 유지 (중복 호출 대응을 위해)
  // 5분 후 자동으로 제거되도록 (타이머는 별도로 구현하지 않음, 필요시 새 녹음 시작 시 클리어)
}

// Side Panel 핸들러 가져오기
import './sidepanel';

// 익스텐션 시작 시 로그
console.log('Background script loaded');

