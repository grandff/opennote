import React from 'react';
import { FaMicrophone, FaStop } from 'react-icons/fa';
import { RecordingStatus } from '@/types/recording';

interface RecordButtonProps {
  status: RecordingStatus;
  duration: string;
  onStart: () => void;
  onStop: () => void;
}

const RecordButton: React.FC<RecordButtonProps> = ({
  status,
  duration,
  onStart,
  onStop,
}) => {
  // Idle 상태: 녹음 시작 버튼
  if (status === 'idle') {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <button
          onClick={onStart}
          className="group relative flex flex-col items-center gap-4 transition-transform hover:scale-105"
        >
          <div className="w-32 h-32 flex items-center justify-center bg-gradient-to-br from-primary-500 to-primary-700 rounded-full shadow-lg group-hover:shadow-xl transition-shadow">
            <FaMicrophone className="w-16 h-16 text-white" />
          </div>
          <span className="text-xl font-semibold text-gray-800">
            Record Start
          </span>
        </button>
      </div>
    );
  }

  // 녹음 중 상태
  return (
    <div className="flex flex-col items-center justify-center py-8 gap-6">
      {/* 타이머 표시 */}
      <div className="text-center">
        <div className="text-5xl font-bold text-gray-800 mb-2">{duration}</div>
        <div className="text-sm text-gray-500">Recording...</div>
      </div>

      {/* 녹음 상태 표시 */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 rounded-full">
          <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
          <span className="text-red-600 font-medium">녹음 중...</span>
        </div>
      </div>

      {/* 정지 버튼 */}
      <button
        onClick={onStop}
        className="w-16 h-16 flex items-center justify-center bg-red-500 hover:bg-red-600 rounded-full shadow-lg transition-colors"
        title="Stop"
      >
        <FaStop className="w-6 h-6 text-white" />
      </button>
    </div>
  );
};

export default RecordButton;

