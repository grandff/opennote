/// <reference types="chrome"/>

/**
 * 인증 오프스크린 문서
 * Firebase signInWithPopup을 iframe을 통해 처리
 */

// Firebase Hosting URL (배포 후 변경 필요)
const AUTH_URL = 'https://opennote-92175.web.app';

// iframe 생성 및 추가
const iframe = document.createElement('iframe');
iframe.src = AUTH_URL;
iframe.style.display = 'none';
document.documentElement.appendChild(iframe);

console.log('[Auth Offscreen] Loaded, iframe src:', AUTH_URL);

// Chrome 메시지 리스너
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  // 인증 요청이 아니면 무시
  if (message.target !== 'auth-offscreen') {
    return false;
  }

  console.log('[Auth Offscreen] Received message:', message);

  if (message.type === 'firebase-auth') {
    // iframe 메시지 핸들러
    function handleIframeMessage(event: MessageEvent) {
      try {
        // Firebase 내부 메시지 무시
        if (typeof event.data === 'string' && event.data.startsWith('!_{')) {
          return;
        }

        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        console.log('[Auth Offscreen] Received from iframe:', data);
        
        // 리스너 제거
        globalThis.removeEventListener('message', handleIframeMessage);
        
        // 응답 전송
        sendResponse(data);
      } catch (e) {
        console.error('[Auth Offscreen] Error parsing message:', e);
      }
    }

    // iframe 메시지 리스너 등록
    globalThis.addEventListener('message', handleIframeMessage, false);

    // iframe에 인증 시작 메시지 전송
    iframe.contentWindow?.postMessage({ initAuth: true }, new URL(AUTH_URL).origin);
    
    // 비동기 응답을 위해 true 반환
    return true;
  }

  return false;
});

