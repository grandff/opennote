/**
 * STT (Speech-to-Text) 서비스
 * Background Script와 통신하여 STT 기능 제공
 */

export interface STTProgress {
  status: 'idle' | 'uploading' | 'transcribing' | 'completed' | 'error';
  progress: number; // 0-100
  message?: string;
  error?: string;
  text?: string;
}

/**
 * 녹음된 오디오를 텍스트로 변환
 * @param audioBlob 오디오 파일 Blob
 * @param onProgress 진행률 콜백
 * @returns 변환된 텍스트
 */
export async function transcribeAudio(
  audioBlob: Blob,
  onProgress?: (progress: STTProgress) => void
): Promise<string> {
  try {
    // Blob을 Base64로 변환 (Chrome 메시지 전송을 위해)
    const base64String = await blobToBase64(audioBlob);

    onProgress?.({
      status: 'uploading',
      progress: 10,
      message: '오디오 파일 준비 중...',
    });

    // Background Script에 STT 요청
    const response = await chrome.runtime.sendMessage({
      type: 'TRANSCRIBE_AUDIO' as const,
      payload: {
        audioBase64: base64String,
        audioSize: audioBlob.size,
        mimeType: audioBlob.type,
        language: 'ko', // 한국어 기본값 (필요시 변경 가능)
      },
    }) as { success?: boolean; text?: string; error?: string; progress?: STTProgress };

    if (response?.progress) {
      onProgress?.(response.progress);
    }

    if (response?.error) {
      throw new Error(response.error);
    }

    if (!response?.success || !response?.text) {
      throw new Error('STT 변환에 실패했습니다.');
    }

    return response.text;
  } catch (error: any) {
    console.error('STT service error:', error);
    
    onProgress?.({
      status: 'error',
      progress: 0,
      error: error.message || '음성 변환 중 오류가 발생했습니다.',
    });

    throw error;
  }
}

/**
 * Blob을 Base64 문자열로 변환
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = (reader.result as string).split(',')[1]; // data:audio/webm;base64, 제거
      resolve(base64String);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

