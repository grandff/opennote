import React, { useEffect, useState } from 'react';
import { FileText, Download, CheckCircle2 } from 'lucide-react';
import AudioPlayer from './AudioPlayer';

interface RecordingCompleteProps {
  audioUrl: string;
  audioBlob?: Blob;
  duration: number;
  timestamp: number;
  onTranscribe: (language: string) => void;
  onNewRecording: () => void;
}

// 지원하는 언어 목록
const SUPPORTED_LANGUAGES = [
  { code: 'ko', name: '한국어' },
  { code: 'en', name: 'English' },
  { code: 'ja', name: '日本語' },
  { code: 'zh', name: '中文' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'pt', name: 'Português' },
  { code: 'ru', name: 'Русский' },
  { code: 'it', name: 'Italiano' },
];

// 브라우저 언어 감지 함수
const detectBrowserLanguage = (): string => {
  const browserLang = navigator.language || (navigator as any).userLanguage || 'ko';
  const langCode = browserLang.split('-')[0].toLowerCase(); // 'ko-KR' -> 'ko'
  
  // 지원하는 언어 목록에 있는지 확인
  const supported = SUPPORTED_LANGUAGES.find(lang => lang.code === langCode);
  return supported ? langCode : 'ko'; // 기본값은 한국어
};

const RecordingComplete: React.FC<RecordingCompleteProps> = ({
  audioUrl,
  audioBlob,
  duration,
  timestamp,
  onTranscribe,
  onNewRecording,
}) => {
  const [showAnimation, setShowAnimation] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState<string>(() => detectBrowserLanguage());
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  useEffect(() => {
    // 컴포넌트 마운트 시 애니메이션 시작
    setShowAnimation(true);
    const timer = setTimeout(() => {
      setShowAnimation(false);
    }, 2000); // 2초 후 애니메이션 종료

    return () => clearTimeout(timer);
  }, []);

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
        <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4 relative">
          <CheckCircle2 
            className={`w-8 h-8 text-green-500 ${
              showAnimation 
                ? 'animate-checkmark' 
                : ''
            }`}
          />
          {showAnimation && (
            <div className="absolute inset-0 rounded-full bg-green-200 animate-ping opacity-75" />
          )}
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
        {/* 언어 선택 드롭다운 */}
        <div className="flex flex-col gap-2">
          <label htmlFor="language-select" className="text-sm font-medium text-gray-700">
            언어 선택
          </label>
          <select
            id="language-select"
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
            className="w-full py-2 px-3 border border-gray-300 rounded-lg bg-white text-gray-800 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.name}
              </option>
            ))}
          </select>
        </div>

        {/* Transcription 버튼 (메인) */}
        <button
          onClick={() => onTranscribe(selectedLanguage)}
          className="w-full py-4 px-6 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg shadow-lg transition-colors flex items-center justify-center gap-2"
        >
          <FileText className="w-5 h-5" />
          <span>Transcription</span>
        </button>

        {/* 안내 메시지 - 버튼 아래로 이동 */}
        <div className="text-center text-sm text-gray-500">
          Transcription을 진행하면 음성이 텍스트로 변환됩니다.
        </div>

        {/* 부가 액션들 */}
        <div className="flex gap-3">
          <button
            onClick={() => setShowConfirmDialog(true)}
            className="flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
          >
            새 녹음
          </button>

          <button
            onClick={handleDownload}
            className="py-3 px-4 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors"
            title="Download"
          >
            <Download className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 새 녹음 확인 대화창 */}
      {showConfirmDialog && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          {/* 배경 오버레이 */}
          <div 
            className="absolute inset-0 bg-black/30 transition-opacity"
            onClick={() => setShowConfirmDialog(false)}
          />
          
          {/* 대화창 */}
          <div className="relative w-full bg-white rounded-t-2xl shadow-xl animate-slide-up">
            <div className="p-6">
              {/* 핸들 바 */}
              <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-4" />
              
              {/* 메시지 */}
              <div className="text-center mb-6">
                <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  새 녹음을 시작하시겠어요?
                </h3>
                <p className="text-sm text-gray-600">
                  기존에 저장된 파일이 사라집니다.<br />
                  새 녹음을 진행하시겠어요?
                </p>
              </div>

              {/* 버튼들 */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirmDialog(false)}
                  className="flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors"
                >
                  아니오
                </button>
                <button
                  onClick={() => {
                    setShowConfirmDialog(false);
                    onNewRecording();
                  }}
                  className="flex-1 py-3 px-4 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-xl transition-colors"
                >
                  예
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecordingComplete;

