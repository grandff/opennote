/**
 * STT (Speech-to-Text) 서비스
 * Background Script와 통신하여 STT 기능 제공
 */

import { AudioSegment } from '@/types/recording';

export interface STTProgress {
  status: 'idle' | 'uploading' | 'transcribing' | 'completed' | 'error';
  progress: number; // 0-100
  message?: string;
  error?: string;
  text?: string;
  currentSegment?: number;
  totalSegments?: number;
}

// 세그먼트 정보 (offscreen에서 받은 형태)
export interface SegmentData {
  index: number;
  base64: string;
  startTime: number;
  endTime: number;
  size: number;
}

/**
 * 녹음된 오디오를 텍스트로 변환
 * @param audioBlob 오디오 파일 Blob
 * @param language 언어 코드 (기본값: 'ko')
 * @param onProgress 진행률 콜백
 * @returns 변환된 텍스트
 */
export async function transcribeAudio(
  audioBlob: Blob,
  language: string = 'ko',
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
        language: language || 'ko', // 선택된 언어 또는 기본값
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

/**
 * 세그먼트 배열로 분할된 녹음을 텍스트로 변환 (유료 사용자용)
 * @param segments 세그먼트 데이터 배열 (base64 인코딩됨)
 * @param language 언어 코드
 * @param onProgress 진행률 콜백
 * @returns 모든 세그먼트의 변환된 텍스트 (합쳐서)
 */
export async function transcribeSegments(
  segments: SegmentData[],
  language: string = 'ko',
  onProgress?: (progress: STTProgress) => void
): Promise<string> {
  if (!segments || segments.length === 0) {
    throw new Error('세그먼트가 없습니다.');
  }

  const totalSegments = segments.length;
  const results: string[] = [];
  
  onProgress?.({
    status: 'uploading',
    progress: 0,
    message: `세그먼트 준비 중... (0/${totalSegments})`,
    currentSegment: 0,
    totalSegments,
  });

  // 세그먼트를 순서대로 처리
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const progressPercent = Math.floor((i / totalSegments) * 90);
    
    onProgress?.({
      status: 'transcribing',
      progress: progressPercent,
      message: `세그먼트 ${i + 1}/${totalSegments} 처리 중...`,
      currentSegment: i + 1,
      totalSegments,
    });

    try {
      // Background Script에 세그먼트 STT 요청
      const response = await chrome.runtime.sendMessage({
        type: 'TRANSCRIBE_AUDIO',
        payload: {
          audioBase64: segment.base64,
          audioSize: segment.size,
          mimeType: 'audio/webm;codecs=opus',
          language: language || 'ko',
          segmentIndex: segment.index,
          segmentStartTime: segment.startTime,
          segmentEndTime: segment.endTime,
        },
      }) as { success?: boolean; text?: string; error?: string };

      if (response?.error) {
        console.error(`Segment ${i} error:`, response.error);
        // 개별 세그먼트 오류는 건너뛰고 계속 진행
        results.push(`[세그먼트 ${i + 1} 오류: ${response.error}]`);
        continue;
      }

      if (response?.success && response?.text) {
        results.push(response.text);
      }
    } catch (error: any) {
      console.error(`Segment ${i} transcription error:`, error);
      results.push(`[세그먼트 ${i + 1} 오류]`);
    }
  }

  onProgress?.({
    status: 'completed',
    progress: 100,
    message: '모든 세그먼트 변환 완료',
    currentSegment: totalSegments,
    totalSegments,
  });

  // 모든 결과를 합쳐서 반환
  return results.join('\n\n');
}

/**
 * Recording 객체에서 적절한 transcribe 함수 호출
 * audioSegments가 있으면 transcribeSegments, 없으면 transcribeAudio 사용
 */
export async function transcribeRecording(
  recording: { 
    audioBlob?: Blob; 
    audioSegments?: AudioSegment[];
  },
  language: string = 'ko',
  onProgress?: (progress: STTProgress) => void
): Promise<string> {
  // 세그먼트가 있는 경우 (유료 사용자, 20분 이상 녹음)
  if (recording.audioSegments && recording.audioSegments.length > 0) {
    // AudioSegment를 SegmentData로 변환
    const segmentDataPromises = recording.audioSegments.map(async (segment) => {
      const base64 = await blobToBase64(segment.blob);
      return {
        index: segment.index,
        base64,
        startTime: segment.startTime,
        endTime: segment.endTime,
        size: segment.blob.size,
      };
    });
    
    const segmentData = await Promise.all(segmentDataPromises);
    return transcribeSegments(segmentData, language, onProgress);
  }
  
  // 단일 파일인 경우 (무료 사용자 또는 20분 이하)
  if (recording.audioBlob) {
    return transcribeAudio(recording.audioBlob, language, onProgress);
  }
  
  throw new Error('녹음 데이터가 없습니다.');
}

