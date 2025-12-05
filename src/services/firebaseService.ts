/**
 * Firebase 서비스
 * Firestore, Authentication 등을 활용한 데이터 관리
 */

import { 
  getFirestoreInstance, 
  getAuthInstance 
} from '@/config/firebase';
import { 
  collection, 
  addDoc, 
  getDocs, 
  getDoc, 
  doc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  Timestamp,
  QueryConstraint
} from 'firebase/firestore';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';

// ==================== Firestore ====================

/**
 * 녹음 데이터 저장
 */
export interface RecordingData {
  audioUrl?: string;
  audioSize: number;
  duration: number;
  mimeType: string;
  transcription?: string;
  timestamp: number;
  userId?: string;
  metadata?: Record<string, any>;
}

/**
 * Firestore에 녹음 데이터 저장
 */
export const saveRecording = async (data: RecordingData): Promise<string> => {
  try {
    const db = getFirestoreInstance();
    const docRef = await addDoc(collection(db, 'recordings'), {
      ...data,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    console.log('✅ Recording saved to Firestore:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('❌ Error saving recording:', error);
    throw error;
  }
};

/**
 * Firestore에서 녹음 데이터 조회
 */
export const getRecordings = async (
  userId?: string,
  limitCount: number = 50
): Promise<Array<RecordingData & { id: string }>> => {
  try {
    const db = getFirestoreInstance();
    const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc'), limit(limitCount)];
    
    if (userId) {
      constraints.unshift(where('userId', '==', userId));
    }
    
    const q = query(collection(db, 'recordings'), ...constraints);
    const querySnapshot = await getDocs(q);
    
    const recordings: Array<RecordingData & { id: string }> = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      recordings.push({
        id: doc.id,
        ...data,
        timestamp: data.createdAt?.toMillis() || data.timestamp,
      } as RecordingData & { id: string });
    });
    
    return recordings;
  } catch (error) {
    console.error('❌ Error getting recordings:', error);
    throw error;
  }
};

/**
 * 특정 녹음 데이터 조회
 */
export const getRecording = async (recordingId: string): Promise<RecordingData & { id: string } | null> => {
  try {
    const db = getFirestoreInstance();
    const docRef = doc(db, 'recordings', recordingId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        timestamp: data.createdAt?.toMillis() || data.timestamp,
      } as RecordingData & { id: string };
    } else {
      return null;
    }
  } catch (error) {
    console.error('❌ Error getting recording:', error);
    throw error;
  }
};

/**
 * 녹음 데이터 업데이트 (예: transcription 추가)
 */
export const updateRecording = async (
  recordingId: string,
  updates: Partial<RecordingData>
): Promise<void> => {
  try {
    const db = getFirestoreInstance();
    const docRef = doc(db, 'recordings', recordingId);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: Timestamp.now(),
    });
    console.log('✅ Recording updated:', recordingId);
  } catch (error) {
    console.error('❌ Error updating recording:', error);
    throw error;
  }
};

/**
 * 녹음 데이터 삭제
 */
export const deleteRecording = async (recordingId: string): Promise<void> => {
  try {
    const db = getFirestoreInstance();
    const docRef = doc(db, 'recordings', recordingId);
    await deleteDoc(docRef);
    console.log('✅ Recording deleted:', recordingId);
  } catch (error) {
    console.error('❌ Error deleting recording:', error);
    throw error;
  }
};

// ==================== Authentication ====================

/**
 * 이메일/비밀번호로 로그인
 */
export const signIn = async (email: string, password: string): Promise<User> => {
  try {
    const auth = getAuthInstance();
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    console.log('✅ User signed in:', userCredential.user.uid);
    return userCredential.user;
  } catch (error: any) {
    console.error('❌ Error signing in:', error);
    throw new Error(error.message || '로그인에 실패했습니다.');
  }
};

/**
 * 이메일/비밀번호로 회원가입
 */
export const signUp = async (email: string, password: string): Promise<User> => {
  try {
    const auth = getAuthInstance();
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    console.log('✅ User signed up:', userCredential.user.uid);
    return userCredential.user;
  } catch (error: any) {
    console.error('❌ Error signing up:', error);
    throw new Error(error.message || '회원가입에 실패했습니다.');
  }
};

/**
 * 로그아웃
 */
export const logout = async (): Promise<void> => {
  try {
    const auth = getAuthInstance();
    await signOut(auth);
    console.log('✅ User signed out');
  } catch (error: any) {
    console.error('❌ Error signing out:', error);
    throw new Error(error.message || '로그아웃에 실패했습니다.');
  }
};

/**
 * 현재 인증 상태 구독
 * @param callback 사용자 변경 시 호출될 콜백
 * @returns 구독 해제 함수
 */
export const onAuthChange = (callback: (user: User | null) => void): (() => void) => {
  const auth = getAuthInstance();
  return onAuthStateChanged(auth, callback);
};

/**
 * 현재 사용자 가져오기
 */
export const getCurrentUser = (): User | null => {
  const auth = getAuthInstance();
  return auth.currentUser;
};

