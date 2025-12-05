import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FaCopy, FaEdit, FaCheck, FaTimes } from 'react-icons/fa';
import { transcribeAudio, STTProgress } from '@/services/sttService';
import useRecordingStore from '@/stores/recordingStore';

interface TranscriptionScreenProps {
  language: string;
  onBack: () => void;
}

const TranscriptionScreen: React.FC<TranscriptionScreenProps> = ({ language, onBack }) => {
  const { currentRecording } = useRecordingStore();
  const [progress, setProgress] = useState<STTProgress>({
    status: 'idle',
    progress: 0,
  });
  const [transcribedText, setTranscribedText] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState('');
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const startTranscription = useCallback(async () => {
    // 이미 transcription이 완료된 경우 중복 호출 방지
    if (currentRecording?.transcription) {
      setTranscribedText(currentRecording.transcription);
      setEditedText(currentRecording.transcription);
      setProgress({
        status: 'completed',
        progress: 100,
        message: '완료',
      });
      return;
    }
    
    if (!currentRecording?.audioBlob) {
      setProgress({
        status: 'error',
        progress: 0,
        error: '오디오 파일을 찾을 수 없습니다.',
      });
      return;
    }

    try {
      setProgress({
        status: 'uploading',
        progress: 0,
        message: '음성 변환을 시작합니다...',
      });

      const text = await transcribeAudio(currentRecording.audioBlob, language, (prog) => {
        setProgress(prog);
      });

      setTranscribedText(text);
      setEditedText(text);
      
      // Store에 transcription 저장 (중복 호출 방지)
      if (currentRecording) {
        useRecordingStore.getState().setCurrentRecording({
          ...currentRecording,
          transcription: text,
        });
      }
    } catch (error: any) {
      console.error('Transcription error:', error);
      setProgress({
        status: 'error',
        progress: 0,
        error: error.message || '음성 변환 중 오류가 발생했습니다.',
      });
    }
  }, [currentRecording, language]);

  useEffect(() => {
    // 이미 transcription이 완료된 경우 바로 표시
    if (currentRecording?.transcription && !transcribedText) {
      setTranscribedText(currentRecording.transcription);
      setEditedText(currentRecording.transcription);
      setProgress({
        status: 'completed',
        progress: 100,
        message: '완료',
      });
      return;
    }
    
    // 컴포넌트 마운트 시 또는 새로운 recording이 있을 때 자동으로 STT 시작
    if (currentRecording?.audioBlob && !currentRecording?.transcription && progress.status === 'idle' && !transcribedText) {
      startTranscription();
    }
  }, [currentRecording?.audioBlob, currentRecording?.transcription, startTranscription, transcribedText, progress.status]);

  // 편집 모드 진입 시 포커스
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(textareaRef.current.value.length, textareaRef.current.value.length);
    }
  }, [isEditing]);

  const handleCopy = async () => {
    const textToCopy = isEditing ? editedText : transcribedText;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
      // Fallback: 선택 후 복사
      if (textareaRef.current) {
        textareaRef.current.select();
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
    setEditedText(transcribedText);
  };

  const handleSave = () => {
    setTranscribedText(editedText);
    setIsEditing(false);
    
    // Store에도 업데이트된 transcription 저장
    if (currentRecording) {
      useRecordingStore.getState().setCurrentRecording({
        ...currentRecording,
        transcription: editedText,
      });
    }
  };

  const handleCancel = () => {
    setEditedText(transcribedText);
    setIsEditing(false);
  };

  const handleRetry = () => {
    setProgress({ status: 'idle', progress: 0 });
    setTranscribedText('');
    startTranscription();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-xl font-bold text-gray-800">Transcription</h2>
        <button
          onClick={onBack}
          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
        >
          뒤로
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* 진행률 표시 - 인디케이터 스타일 */}
        {progress.status !== 'completed' && progress.status !== 'error' && (
          <div className="flex flex-col items-center justify-center py-12">
            {/* 원형 인디케이터 */}
            <div className="relative w-20 h-20 mb-6">
              {/* 배경 원 */}
              <div className="absolute inset-0 rounded-full border-4 border-gray-200" />
              {/* 애니메이션 원 */}
              <div className="absolute inset-0 rounded-full border-4 border-primary-500 border-t-transparent animate-spin" />
              {/* 중앙 아이콘 */}
              <div className="absolute inset-0 flex items-center justify-center">
                <svg className="w-8 h-8 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </div>
            </div>

            {/* 상태 메시지 */}
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                {progress.status === 'uploading' ? '오디오 파일 분석 중' : '텍스트로 필사 중'}
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                {progress.status === 'uploading' 
                  ? '녹음된 오디오를 분석하고 있습니다...'
                  : '음성을 텍스트로 변환하고 있습니다...'}
              </p>
              
              {/* 점 애니메이션 */}
              <div className="flex items-center justify-center gap-1">
                <div className="w-2 h-2 bg-primary-500 rounded-full animate-dot-1" />
                <div className="w-2 h-2 bg-primary-500 rounded-full animate-dot-2" />
                <div className="w-2 h-2 bg-primary-500 rounded-full animate-dot-3" />
              </div>
            </div>
          </div>
        )}

        {/* 에러 표시 */}
        {progress.status === 'error' && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 font-medium mb-2">오류 발생</p>
            <p className="text-sm text-red-600 mb-4">{progress.error}</p>
            <button
              onClick={handleRetry}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              다시 시도
            </button>
          </div>
        )}

        {/* 텍스트 표시 영역 */}
        {progress.status === 'completed' && transcribedText && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">변환된 텍스트</h3>
              <div className="flex gap-2">
                {!isEditing && (
                  <button
                    onClick={handleEdit}
                    className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    <FaEdit className="w-4 h-4" />
                    편집
                  </button>
                )}
                {isEditing && (
                  <>
                    <button
                      onClick={handleSave}
                      className="flex items-center gap-2 px-3 py-2 text-sm bg-green-100 hover:bg-green-200 text-green-700 rounded-lg transition-colors"
                    >
                      <FaCheck className="w-4 h-4" />
                      저장
                    </button>
                    <button
                      onClick={handleCancel}
                      className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                      <FaTimes className="w-4 h-4" />
                      취소
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
              {isEditing ? (
                <textarea
                  ref={textareaRef}
                  value={editedText}
                  onChange={(e) => setEditedText(e.target.value)}
                  className="w-full h-96 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                  placeholder="텍스트를 편집하세요..."
                />
              ) : (
                <div className="whitespace-pre-wrap text-gray-800 leading-relaxed">
                  {transcribedText}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 빈 상태 */}
        {progress.status === 'idle' && !transcribedText && (
          <div className="flex flex-col items-center justify-center py-12">
            {/* 원형 인디케이터 */}
            <div className="relative w-20 h-20 mb-6">
              <div className="absolute inset-0 rounded-full border-4 border-gray-200" />
              <div className="absolute inset-0 rounded-full border-4 border-primary-500 border-t-transparent animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <svg className="w-8 h-8 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </div>
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">필사 준비 중</h3>
            <p className="text-sm text-gray-500 mb-4">오디오 파일을 준비하고 있습니다...</p>
            <div className="flex items-center justify-center gap-1">
              <div className="w-2 h-2 bg-primary-500 rounded-full animate-dot-1" />
              <div className="w-2 h-2 bg-primary-500 rounded-full animate-dot-2" />
              <div className="w-2 h-2 bg-primary-500 rounded-full animate-dot-3" />
            </div>
          </div>
        )}
      </div>

      {/* 하단 버튼 (오른쪽 하단 고정) */}
      {progress.status === 'completed' && transcribedText && (
        <div className="fixed bottom-6 right-6">
          <button
            onClick={handleCopy}
            className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg transition-all ${
              copied
                ? 'bg-green-500 text-white'
                : 'bg-primary-600 hover:bg-primary-700 text-white'
            }`}
          >
            <FaCopy className="w-4 h-4" />
            <span>{copied ? '복사됨!' : '복사'}</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default TranscriptionScreen;


