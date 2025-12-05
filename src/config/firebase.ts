/**
 * Firebase 초기화 및 설정
 * Note: Analytics는 Chrome 확장 프로그램에서 지원되지 않으므로 제외
 */

import { initializeApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';

// Firebase 설정 (Analytics 제외)
const firebaseConfig = {
  apiKey: "AIzaSyBoGlldLASalCUzgUsBQZXvJNcLof387kE",
  authDomain: "opennote-92175.firebaseapp.com",
  projectId: "opennote-92175",
  storageBucket: "opennote-92175.firebasestorage.app",
  messagingSenderId: "517296107940",
  appId: "1:517296107940:web:c4f916d3d36b8fd9ba9131",
};

// Firebase 앱 초기화
let app: FirebaseApp | null = null;
let firestore: Firestore | null = null;
let auth: Auth | null = null;

/**
 * Firebase 초기화
 * @returns 초기화된 Firebase 앱
 */
export const initFirebase = (): FirebaseApp => {
  if (app) {
    return app;
  }

  try {
    app = initializeApp(firebaseConfig);
    console.log('✅ Firebase initialized successfully');
    return app;
  } catch (error) {
    console.error('❌ Firebase initialization error:', error);
    throw error;
  }
};

/**
 * Firestore 인스턴스 가져오기
 * @returns Firestore 인스턴스
 */
export const getFirestoreInstance = (): Firestore => {
  if (!app) {
    initFirebase();
  }
  
  if (!firestore && app) {
    firestore = getFirestore(app);
  }
  
  return firestore!;
};

/**
 * Auth 인스턴스 가져오기
 * @returns Auth 인스턴스
 */
export const getAuthInstance = (): Auth => {
  if (!app) {
    initFirebase();
  }
  
  if (!auth && app) {
    auth = getAuth(app);
  }
  
  return auth!;
};

/**
 * Firebase 앱 인스턴스 가져오기
 * @returns Firebase 앱 인스턴스
 */
export const getFirebaseApp = (): FirebaseApp => {
  if (!app) {
    initFirebase();
  }
  return app!;
};

// 기본 초기화 (필요시)
export default {
  init: initFirebase,
  getFirestore: getFirestoreInstance,
  getAuth: getAuthInstance,
  getApp: getFirebaseApp,
};

