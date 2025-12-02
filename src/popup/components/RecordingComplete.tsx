import React from 'react';
import { FaFileAlt, FaTrash, FaDownload } from 'react-icons/fa';
import AudioPlayer from './AudioPlayer';

interface RecordingCompleteProps {
  audioUrl: string;
  audioBlob?: Blob;
  duration: number;
  timestamp: number;
  onTranscribe: () => void;
  onDelete: () => void;
  onNewRecording: () => void;
}

const RecordingComplete: React.FC<RecordingCompleteProps> = ({
  audioUrl,
  audioBlob,
  duration,
  timestamp,
  onTranscribe,
  onDelete,
  onNewRecording,
}) => {
  // 다운로드 핸들러
  const handleDownload = () => {
    console.log('=== Download button clicked ===');
    console.log('audioBlob:', audioBlob);
    console.log('audioBlob size:', audioBlob?.size);
    console.log('audioUrl:', audioUrl);
    
    if (!audioBlob) {
      console.error('❌ No audioBlob provided to RecordingComplete');
      
      // audioUrl이 있으면 fetch로 Blob 다시 가져오기 시도
      if (audioUrl) {
        console.log('Attempting to fetch blob from audioUrl...');
        fetch(audioUrl)
          .then((response) => response.blob())
          .then((blob) => {
            console.log('✅ Fetched blob from URL, size:', blob.size);
            downloadBlob(blob);
          })
          .catch((error) => {
            console.error('❌ Failed to fetch blob from URL:', error);
            alert('다운로드할 오디오를 가져올 수 없습니다. 녹음을 다시 시도해주세요.');
          });
        return;
      }
      
      alert('다운로드할 오디오가 없습니다. 녹음을 다시 시도해주세요.');
      return;
    }

    downloadBlob(audioBlob);
  };
  
  // Blob 다운로드 헬퍼 함수
  const downloadBlob = (blob: Blob) => {
    try {
      // 파일명 생성 (예: recording-2025-12-01-10-30-15.webm)
      const date = new Date(timestamp);
      const fileName = `recording-${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}-${String(date.getHours()).padStart(2, '0')}-${String(date.getMinutes()).padStart(2, '0')}-${String(date.getSeconds()).padStart(2, '0')}.webm`;

      console.log('Downloading file:', fileName);
      console.log('Blob size:', blob.size);
      console.log('Blob type:', blob.type);

      // Blob URL 생성 및 다운로드
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      // URL 정리 (약간의 지연 후)
      setTimeout(() => {
        URL.revokeObjectURL(url);
        console.log('✅ Download completed and URL revoked');
      }, 100);
    } catch (error) {
      console.error('❌ Error downloading blob:', error);
      alert('다운로드 중 오류가 발생했습니다: ' + (error as Error).message);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* 완료 메시지 */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
          <svg
            className="w-8 h-8 text-green-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          녹음 완료!
        </h2>
        <p className="text-gray-600">
          녹음이 성공적으로 완료되었습니다.
        </p>
      </div>

      {/* 오디오 플레이어 */}
      <AudioPlayer audioUrl={audioUrl} duration={duration} />

      {/* 액션 버튼들 */}
      <div className="flex flex-col gap-3">
        {/* Transcription 버튼 (메인) */}
        <button
          onClick={onTranscribe}
          className="w-full py-4 px-6 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg shadow-lg transition-colors flex items-center justify-center gap-2"
        >
          <FaFileAlt className="w-5 h-5" />
          <span>Transcription</span>
        </button>

        {/* 부가 액션들 */}
        <div className="flex gap-3">
          <button
            onClick={onNewRecording}
            className="flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
          >
            새 녹음
          </button>

          <button
            onClick={handleDownload}
            className="py-3 px-4 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors"
            title="Download"
          >
            <FaDownload className="w-5 h-5" />
          </button>

          <button
            onClick={onDelete}
            className="py-3 px-4 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors"
            title="Delete"
          >
            <FaTrash className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 안내 메시지 */}
      <div className="text-center text-sm text-gray-500">
        Transcription을 진행하면 음성이 텍스트로 변환됩니다.
      </div>
    </div>
  );
};

export default RecordingComplete;

