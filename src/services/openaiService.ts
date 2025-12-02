/**
 * OpenAI API 서비스
 * Background Script에서만 사용 (API 키 보안)
 */

interface TranscriptionResponse {
  text: string;
}

interface TranscriptionProgress {
  status: 'idle' | 'uploading' | 'transcribing' | 'completed' | 'error';
  progress: number; // 0-100
  message?: string;
  error?: string;
}

/**
 * OpenAI Whisper API로 음성을 텍스트로 변환
 * @param audioBlob 오디오 파일 Blob
 * @param onProgress 진행률 콜백
 * @returns 변환된 텍스트
 */
export async function transcribeAudio(
  audioBlob: Blob,
  onProgress?: (progress: TranscriptionProgress) => void
): Promise<string> {
  // 환경 변수에서 API 키 가져오기 (빌드 시 주입됨)
  const API_KEY = import.meta.env.VITE_OPENAI_API_KEY || '';

  if (!API_KEY || API_KEY === '' || API_KEY === 'sk-your-api-key-here') {
    throw new Error('OpenAI API 키가 설정되지 않았습니다. .env 파일에 VITE_OPENAI_API_KEY를 설정하고 다시 빌드해주세요.');
  }

  try {
    // 1. 오디오 파일을 FormData로 변환
    onProgress?.({
      status: 'uploading',
      progress: 10,
      message: '오디오 파일 준비 중...',
    });

    const formData = new FormData();
    formData.append('file', audioBlob, 'recording.webm');
    formData.append('model', 'whisper-1');
    formData.append('language', 'ko'); // 한국어로 설정 (선택사항)

    // 2. OpenAI API 호출
    onProgress?.({
      status: 'transcribing',
      progress: 30,
      message: '음성을 텍스트로 변환 중...',
    });

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
      throw new Error(errorData.error?.message || `API 호출 실패: ${response.status} ${response.statusText}`);
    }

    onProgress?.({
      status: 'transcribing',
      progress: 80,
      message: '변환 완료 처리 중...',
    });

    const result: TranscriptionResponse = await response.json();

    onProgress?.({
      status: 'completed',
      progress: 100,
      message: '완료',
    });

    return result.text || '';
  } catch (error: any) {
    console.error('Transcription error:', error);
    
    onProgress?.({
      status: 'error',
      progress: 0,
      error: error.message || '음성 변환 중 오류가 발생했습니다.',
    });

    throw error;
  }
}

