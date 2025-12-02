/**
 * IndexedDB 유틸리티
 * 큰 오디오 데이터를 저장하기 위해 사용
 */

const DB_NAME = 'audio_recordings_db';
const DB_VERSION = 1;
const STORE_NAME = 'recordings';

/**
 * IndexedDB 열기
 * Service Worker와 일반 컨텍스트 모두에서 작동
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    // Service Worker에서는 self.indexedDB, 일반 컨텍스트에서는 indexedDB
    const idb = typeof self !== 'undefined' && self.indexedDB ? self.indexedDB : indexedDB;
    
    if (!idb) {
      reject(new Error('IndexedDB is not available in this context'));
      return;
    }
    
    const request = idb.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('Failed to open IndexedDB:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // 기존 object store가 있으면 삭제
      if (db.objectStoreNames.contains(STORE_NAME)) {
        db.deleteObjectStore(STORE_NAME);
      }
      
      // 새 object store 생성
      const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      objectStore.createIndex('timestamp', 'timestamp', { unique: false });
      
      console.log('IndexedDB object store created');
    };
  });
}

/**
 * 오디오 데이터 저장
 */
export async function saveAudioData(
  id: string,
  audioBlobBase64: string,
  audioBlobSize: number,
  audioBlobType: string
): Promise<void> {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    const data = {
      id,
      audioBlobBase64,
      audioBlobSize,
      audioBlobType,
      timestamp: Date.now(),
    };
    
    const request = store.put(data);
    
    request.onsuccess = () => {
      console.log('✅ Saved audio data to IndexedDB, id:', id, 'size:', audioBlobSize);
      resolve();
    };
    
    request.onerror = () => {
      console.error('❌ Failed to save to IndexedDB:', request.error);
      reject(request.error);
    };
  });
}

/**
 * 오디오 데이터 가져오기
 */
export async function getAudioData(id: string): Promise<{
  audioBlobBase64: string;
  audioBlobSize: number;
  audioBlobType: string;
} | null> {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);
    
    request.onsuccess = () => {
      const result = request.result;
      if (result) {
        console.log('✅ Retrieved audio data from IndexedDB, id:', id);
        resolve({
          audioBlobBase64: result.audioBlobBase64,
          audioBlobSize: result.audioBlobSize,
          audioBlobType: result.audioBlobType,
        });
      } else {
        console.warn('⚠️ No audio data found in IndexedDB for id:', id);
        resolve(null);
      }
    };
    
    request.onerror = () => {
      console.error('❌ Failed to get from IndexedDB:', request.error);
      reject(request.error);
    };
  });
}

/**
 * 오디오 데이터 삭제
 */
export async function deleteAudioData(id: string): Promise<void> {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);
    
    request.onsuccess = () => {
      console.log('✅ Deleted audio data from IndexedDB, id:', id);
      resolve();
    };
    
    request.onerror = () => {
      console.error('❌ Failed to delete from IndexedDB:', request.error);
      reject(request.error);
    };
  });
}

/**
 * 모든 오디오 데이터 ID 가져오기 (디버깅용)
 */
export async function getAllAudioDataIds(): Promise<string[]> {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAllKeys();
    
    request.onsuccess = () => {
      const keys = request.result as string[];
      resolve(keys);
    };
    
    request.onerror = () => {
      console.error('❌ Failed to get keys from IndexedDB:', request.error);
      reject(request.error);
    };
  });
}

