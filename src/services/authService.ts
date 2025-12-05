/**
 * Firebase 인증 서비스
 * 오프스크린 문서를 통한 Google 로그인 구현
 */

import { 
  getAuth, 
  signInWithCredential,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  User as FirebaseUser,
} from 'firebase/auth/web-extension';
import { initFirebase } from '@/config/firebase';
import useAuthStore, { User } from '@/stores/authStore';

// Firebase 초기화
initFirebase();

// Auth 인스턴스
const auth = getAuth();

// 오프스크린 문서 경로
const AUTH_OFFSCREEN_PATH = '/src/offscreen/auth-offscreen.html';

// 오프스크린 문서 생성 중 플래그
let creatingOffscreenDocument: Promise<void> | null = null;

/**
 * Firebase User를 Store User 형식으로 변환
 */
const firebaseUserToUser = (firebaseUser: FirebaseUser): User => ({
  uid: firebaseUser.uid,
  email: firebaseUser.email,
  displayName: firebaseUser.displayName,
  photoURL: firebaseUser.photoURL,
});

/**
 * 오프스크린 문서가 존재하는지 확인
 */
async function hasOffscreenDocument(): Promise<boolean> {
  // Chrome 116+ 에서는 getContexts API 사용
  if ('getContexts' in chrome.runtime) {
    const contexts = await (chrome.runtime as any).getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT'],
      documentUrls: [chrome.runtime.getURL(AUTH_OFFSCREEN_PATH)],
    });
    return contexts.length > 0;
  }
  
  // 이전 버전 호환: 오프스크린 문서가 있는지 확인할 수 없으므로 false 반환
  return false;
}

/**
 * 오프스크린 문서 설정
 */
async function setupOffscreenDocument(): Promise<void> {
  if (await hasOffscreenDocument()) {
    return;
  }

  if (creatingOffscreenDocument) {
    await creatingOffscreenDocument;
    return;
  }

  creatingOffscreenDocument = chrome.offscreen.createDocument({
    url: AUTH_OFFSCREEN_PATH,
    reasons: [chrome.offscreen.Reason.DOM_SCRAPING],
    justification: 'Firebase authentication with Google sign-in popup',
  });

  await creatingOffscreenDocument;
  creatingOffscreenDocument = null;
}

/**
 * 오프스크린 문서 닫기
 */
async function closeOffscreenDocument(): Promise<void> {
  if (await hasOffscreenDocument()) {
    await chrome.offscreen.closeDocument();
  }
}

/**
 * 오프스크린을 통한 Firebase 인증
 */
async function getAuthFromOffscreen(): Promise<any> {
  await setupOffscreenDocument();
  
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        type: 'firebase-auth',
        target: 'auth-offscreen',
      },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        
        if (response?.success) {
          resolve(response);
        } else if (response?.error) {
          reject(new Error(response.error.message || '인증 실패'));
        } else {
          reject(new Error('Unknown error'));
        }
      }
    );
  });
}

/**
 * Google 로그인
 */
export const signInWithGoogle = async (): Promise<User> => {
  const { setStatus, setUser, setError } = useAuthStore.getState();
  
  setStatus('loading');
  
  try {
    // 오프스크린 문서를 통해 인증
    const authResult = await getAuthFromOffscreen();
    
    console.log('✅ Auth result from offscreen:', authResult);
    
    // credential이 있으면 Firebase에 로그인
    if (authResult.credential?.accessToken) {
      const credential = GoogleAuthProvider.credential(
        authResult.credential.idToken,
        authResult.credential.accessToken
      );
      await signInWithCredential(auth, credential);
    }
    
    // 사용자 정보 저장
    const user: User = {
      uid: authResult.user.uid,
      email: authResult.user.email,
      displayName: authResult.user.displayName,
      photoURL: authResult.user.photoURL,
    };
    
    setUser(user);
    
    // 오프스크린 문서 닫기
    await closeOffscreenDocument();
    
    console.log('✅ Google 로그인 성공:', user.email);
    return user;
    
  } catch (error: any) {
    console.error('❌ Google 로그인 실패:', error);
    setError(error.message || '로그인에 실패했습니다.');
    
    // 오프스크린 문서 닫기
    await closeOffscreenDocument();
    
    throw error;
  }
};

/**
 * 로그아웃
 */
export const logOut = async (): Promise<void> => {
  const { logout, setStatus } = useAuthStore.getState();
  
  setStatus('loading');
  
  try {
    await signOut(auth);
    logout();
    console.log('✅ 로그아웃 성공');
    
  } catch (error: any) {
    console.error('❌ 로그아웃 실패:', error);
    throw error;
  }
};

/**
 * 인증 상태 변화 리스너 설정
 */
export const initAuthListener = (): (() => void) => {
  const { setUser, setStatus } = useAuthStore.getState();
  
  const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
    if (firebaseUser) {
      const user = firebaseUserToUser(firebaseUser);
      setUser(user);
      console.log('🔐 인증 상태: 로그인됨', user.email);
    } else {
      setUser(null);
      setStatus('unauthenticated');
      console.log('🔓 인증 상태: 로그아웃됨');
    }
  });
  
  return unsubscribe;
};

/**
 * 현재 사용자 가져오기
 */
export const getCurrentUser = (): FirebaseUser | null => {
  return auth.currentUser;
};

export default {
  signInWithGoogle,
  logOut,
  initAuthListener,
  getCurrentUser,
};
