import React, { useState, useEffect, useRef } from 'react';
import { FaCopy, FaEdit, FaCheck, FaTimes, FaSpinner } from 'react-icons/fa';
import { transcribeAudio, STTProgress } from '@/services/sttService';
import useRecordingStore from '@/stores/recordingStore';

interface TranscriptionScreenProps {
  onBack: () => void;
}

const TranscriptionScreen: React.FC<TranscriptionScreenProps> = ({ onBack }) => {
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

  useEffect(() => {
    // 컴포넌트 마운트 시 자동으로 STT 시작
    if (currentRecording?.audioBlob && progress.status === 'idle') {
      startTranscription();
    }
  }, [currentRecording?.audioBlob]);

  // 편집 모드 진입 시 포커스
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(textareaRef.current.value.length, textareaRef.current.value.length);
    }
  }, [isEditing]);

  const startTranscription = async () => {
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

      const text = await transcribeAudio(currentRecording.audioBlob, (prog) => {
        setProgress(prog);
      });

      setTranscribedText(text);
      setEditedText(text);
    } catch (error: any) {
      console.error('Transcription error:', error);
      setProgress({
        status: 'error',
        progress: 0,
        error: error.message || '음성 변환 중 오류가 발생했습니다.',
      });
    }
  };

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
        {/* 진행률 표시 */}
        {progress.status !== 'completed' && progress.status !== 'error' && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">
                {progress.message || '처리 중...'}
              </span>
              <span className="text-sm text-gray-500">{progress.progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress.progress}%` }}
              />
            </div>
            {progress.status === 'transcribing' && (
              <div className="flex items-center justify-center mt-4">
                <FaSpinner className="animate-spin text-primary-600 mr-2" />
                <span className="text-sm text-gray-600">음성을 텍스트로 변환 중...</span>
              </div>
            )}
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
          <div className="text-center py-12">
            <FaSpinner className="animate-spin text-primary-600 text-4xl mx-auto mb-4" />
            <p className="text-gray-600">음성 변환을 준비 중...</p>
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


