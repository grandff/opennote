import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getAuth, signInWithPopup, GoogleAuthProvider } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

// Firebase 설정
const firebaseConfig = {
  apiKey: "AIzaSyBoGlldLASalCUzgUsBQZXvJNcLof387kE",
  authDomain: "opennote-92175.firebaseapp.com",
  projectId: "opennote-92175",
  storageBucket: "opennote-92175.firebasestorage.app",
  messagingSenderId: "517296107940",
  appId: "1:517296107940:web:c4f916d3d36b8fd9ba9131",
};

// Firebase 초기화
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// 부모 프레임 (오프스크린 문서)
const PARENT_FRAME = document.location.ancestorOrigins[0];

// Google Auth Provider
const provider = new GoogleAuthProvider();

// 응답 전송
function sendResponse(result) {
  globalThis.parent.postMessage(JSON.stringify(result), PARENT_FRAME);
}

// 메시지 리스너
globalThis.addEventListener('message', function({ data }) {
  if (data.initAuth) {
    signInWithPopup(auth, provider)
      .then((result) => {
        const user = result.user;
        sendResponse({
          success: true,
          user: {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
          },
          credential: {
            accessToken: result._tokenResponse?.oauthAccessToken || null,
            idToken: result._tokenResponse?.oauthIdToken || null,
          }
        });
      })
      .catch((error) => {
        sendResponse({
          success: false,
          error: {
            code: error.code,
            message: error.message,
          }
        });
      });
  }
});

