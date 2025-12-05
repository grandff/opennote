import React, { useState, useRef, useEffect } from 'react';
import useRealtimeStore, { MemoItem } from '@/stores/realtimeStore';

interface MemoTabProps {
  isRecording: boolean;
  currentDuration: string; // 현재 녹음 시간 (예: "00:05:23")
}

const MemoTab: React.FC<MemoTabProps> = ({ isRecording, currentDuration }) => {
  const { memoList, addMemo } = useRealtimeStore();
  const [inputValue, setInputValue] = useState('');
  const listEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 새 메모가 추가되면 스크롤을 아래로
  useEffect(() => {
    if (listEndRef.current) {
      listEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [memoList]);

  // 엔터 키 핸들러
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // 메모 추가
  const handleSubmit = () => {
    const trimmedValue = inputValue.trim();
    if (!trimmedValue || !isRecording) return;

    addMemo(currentDuration, trimmedValue);
    setInputValue('');
    inputRef.current?.focus();
  };

  // 입력 변경 (최대 1000자)
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value.length <= 1000) {
      setInputValue(value);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* 메모 목록 영역 */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {memoList.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <p className="text-sm">
              {isRecording 
                ? '메모를 입력하고 Enter를 누르세요'
                : '녹음을 시작하면 메모를 추가할 수 있습니다'
              }
            </p>
          </div>
        ) : (
          <>
            {memoList.map((memo: MemoItem) => (
              <div
                key={memo.id}
                className="flex gap-3 p-3 bg-gray-50 rounded-xl"
              >
                <span className="flex-shrink-0 text-xs font-mono text-primary-600 bg-primary-50 px-2 py-1 rounded-lg">
                  {memo.timestamp}
                </span>
                <p className="text-sm text-gray-700 leading-relaxed break-words">
                  {memo.content}
                </p>
              </div>
            ))}
            <div ref={listEndRef} />
          </>
        )}
      </div>

      {/* 입력 영역 (하단 고정) */}
      <div className="flex-shrink-0 p-3 border-t border-gray-100 bg-white">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={isRecording ? "메모 입력 후 Enter..." : "녹음 중에만 입력 가능"}
            disabled={!isRecording}
            maxLength={1000}
            className={`
              flex-1 px-4 py-2.5
              text-sm text-gray-700
              bg-gray-50 border border-gray-200 rounded-full
              focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
              placeholder:text-gray-400
              ${!isRecording ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          />
          <button
            onClick={handleSubmit}
            disabled={!isRecording || !inputValue.trim()}
            className={`
              flex-shrink-0 px-4 py-2.5
              text-sm font-medium text-white
              bg-primary-500 rounded-full
              hover:bg-primary-600 
              focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2
              transition-colors
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
          >
            추가
          </button>
        </div>
        {inputValue.length > 0 && (
          <p className="mt-1 text-xs text-gray-400 text-right">
            {inputValue.length}/1000
          </p>
        )}
      </div>
    </div>
  );
};

export default MemoTab;
