import React, { useEffect, useRef } from 'react';
import useRealtimeStore from '@/stores/realtimeStore';
import { FaRobot, FaExclamationCircle, FaSync, FaLanguage } from 'react-icons/fa';

interface RealtimeTabProps {
  isRecording: boolean;
}

const RealtimeTab: React.FC<RealtimeTabProps> = ({ isRecording }) => {
  const {
    status,
    error,
    translation,
    isTranslating,
    summary,
    config,
  } = useRealtimeStore();

  const contentRef = useRef<HTMLDivElement>(null);

  // 자동 스크롤
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [summary, translation]);

  // 연결 상태 표시
  const renderConnectionStatus = () => {
    if (status === 'connecting') {
      return (
        <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-3 py-2 rounded-lg text-sm">
          <FaSync className="w-3 h-3 animate-spin" />
          <span>AI 서버에 연결 중...</span>
        </div>
      );
    }

    if (status === 'stopped') {
      return (
        <div className="flex items-center gap-2 text-gray-600 bg-gray-100 px-3 py-2 rounded-lg text-sm">
          <FaExclamationCircle className="w-3 h-3" />
          <span>연결 중단됨</span>
        </div>
      );
    }

    if (status === 'error' || error) {
      return (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 px-3 py-2 rounded-lg text-sm">
          <FaExclamationCircle className="w-3 h-3" />
          <span>{error || '연결 오류'}</span>
        </div>
      );
    }

    if (status === 'connected') {
      return (
        <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg text-sm">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
          <span>{config.purpose === 'summary' ? 'AI 노트 정리 중' : '실시간 번역 중'}</span>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2 text-gray-500 bg-gray-50 px-3 py-2 rounded-lg text-sm">
        <div className="w-2 h-2 bg-gray-400 rounded-full" />
        <span>대기 중</span>
      </div>
    );
  };

  // 녹음 중이 아닐 때
  if (!isRecording) {
    const Icon = config.purpose === 'summary' ? FaRobot : FaLanguage;
    return (
      <div className="flex flex-col items-center justify-center py-8 text-gray-500">
        <Icon className="w-12 h-12 mb-4 text-gray-300" />
        <p className="text-center">
          녹음을 시작하면<br />
          {config.purpose === 'summary' 
            ? 'AI가 실시간으로 노트를 정리합니다'
            : '실시간으로 번역됩니다'}
        </p>
      </div>
    );
  }

  // 요약 모드
  if (config.purpose === 'summary') {
    return (
      <div className="flex flex-col gap-3 p-2 h-full">
        <div className="flex justify-center">
          {renderConnectionStatus()}
        </div>

        <div className="flex-1 bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col">
          <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-violet-50 to-purple-100 border-b border-purple-200">
            <FaRobot className="w-4 h-4 text-purple-600" />
            <span className="text-sm font-medium text-purple-800">AI 노트정리</span>
            {status === 'connected' && !summary && (
              <div className="ml-auto flex items-center gap-1">
                <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-pulse" />
                <span className="text-xs text-purple-600">분석 중...</span>
              </div>
            )}
          </div>
          <div
            ref={contentRef}
            className="flex-1 p-4 overflow-y-auto text-sm text-gray-700 leading-relaxed min-h-[200px]"
          >
            {summary ? (
              <div className="prose prose-sm max-w-none">
                <div 
                  className="whitespace-pre-wrap"
                  dangerouslySetInnerHTML={{ 
                    __html: formatMarkdown(summary) 
                  }}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <FaRobot className="w-8 h-8 mb-3 opacity-50" />
                <p className="text-center italic">
                  음성을 인식하면<br />
                  AI가 노트를 정리해드립니다...
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 번역 모드
  return (
    <div className="flex flex-col gap-3 p-2 h-full">
      <div className="flex justify-center">
        {renderConnectionStatus()}
      </div>

      <div className="flex-1 bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col">
        <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-blue-50 to-cyan-100 border-b border-cyan-200">
          <FaLanguage className="w-4 h-4 text-cyan-600" />
          <span className="text-sm font-medium text-cyan-800">실시간 번역</span>
          {isTranslating && (
            <div className="ml-auto flex items-center gap-1">
              <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-pulse" />
              <span className="text-xs text-cyan-600">번역 중...</span>
            </div>
          )}
        </div>
        <div
          ref={contentRef}
          className="flex-1 p-4 overflow-y-auto text-sm text-gray-700 leading-relaxed min-h-[200px]"
        >
          {translation ? (
            <div className="whitespace-pre-wrap">
              {translation}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <FaLanguage className="w-8 h-8 mb-3 opacity-50" />
              <p className="text-center italic">
                음성을 인식하면<br />
                실시간으로 번역됩니다...
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * 간단한 마크다운 포맷팅
 */
function formatMarkdown(text: string): string {
  return text
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold text-gray-800 mt-3 mb-1">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-semibold text-gray-800 mt-4 mb-2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold text-gray-900 mt-4 mb-2">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-gray-800">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em class="italic">$1</em>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc text-gray-700">$1</li>')
    .replace(/^\* (.+)$/gm, '<li class="ml-4 list-disc text-gray-700">$1</li>')
    .replace(/(<li[^>]*>.*<\/li>\n?)+/g, '<ul class="my-2 space-y-1">$&</ul>')
    .replace(/\n/g, '<br />');
}

export default RealtimeTab;
