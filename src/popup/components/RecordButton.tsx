import React, { useState } from 'react';
import { FaMicrophone, FaStop, FaRobot, FaStickyNote } from 'react-icons/fa';
import { RecordingStatus } from '@/types/recording';
import MemoTab from './MemoTab';
// import RealtimeTab from './RealtimeTab';
// import realtimeService from '@/services/realtimeService';
// import useRealtimeStore, { SUPPORTED_LANGUAGES } from '@/stores/realtimeStore';

interface RecordButtonProps {
  status: RecordingStatus;
  duration: string;
  onStart: () => void;
  onStop: () => void;
}

type TabType = 'memo' | 'realtime';

const RecordButton: React.FC<RecordButtonProps> = ({
  status,
  duration,
  onStart,
  onStop,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('memo');
  const isRecording = status === 'recording';
  
  /* ===== Realtime 기능 보류 =====
  const audioPortRef = useRef<chrome.runtime.Port | null>(null);
  
  const {
    setStatus: setRealtimeStatus,
    setSessionId,
    setError,
    updateTranscription,
    updateTranslation,
    setSummary,
    resetResults,
    config,
    setConfig,
  } = useRealtimeStore();

  /* ===== Realtime 기능 보류 =====
  // Background로부터 오디오 청크 수신을 위한 포트 연결
  useEffect(() => {
    if (isRecording) {
      try {
        audioPortRef.current = chrome.runtime.connect({ name: 'realtime-audio' });
        
        audioPortRef.current.onMessage.addListener((message) => {
          if (message.type === 'REALTIME_AUDIO_CHUNK') {
            if (realtimeService.isConnected()) {
              try {
                realtimeService.sendAudioChunk(message.audioChunk);
              } catch (error) {
                console.warn('[Realtime] Failed to send audio chunk:', error);
              }
            }
          }
        });
        
        audioPortRef.current.onDisconnect.addListener(() => {
          console.log('[Realtime] Audio port disconnected');
          audioPortRef.current = null;
        });
      } catch (error) {
        console.warn('[Realtime] Failed to connect audio port:', error);
      }
    }
    
    return () => {
      if (audioPortRef.current) {
        audioPortRef.current.disconnect();
        audioPortRef.current = null;
      }
    };
  }, [isRecording]);

  // Realtime 연결 관리 - 녹음 시작/중지 시
  useEffect(() => {
    if (isRecording) {
      connectRealtime();
    } else {
      disconnectRealtime();
    }
    
    return () => {
      disconnectRealtime();
    };
  }, [isRecording]);

  const connectRealtime = async () => {
    try {
      realtimeService.reset();
      
      setRealtimeStatus('connecting');
      setError(null);
      resetResults();

      realtimeService.setHandlers({
        onTranscription: (text, isDelta) => {
          updateTranscription(text, isDelta);
        },
        onTranslation: (text, isDelta) => {
          updateTranslation(text, isDelta);
        },
        onSummary: (summary, _isDelta) => {
          setSummary(summary);
        },
        onError: (error) => {
          console.error('[Realtime] Error:', error);
          setError(error);
        },
        onSessionCreated: (sessionId) => {
          setSessionId(sessionId);
          setRealtimeStatus('connected');
        },
        onSessionClosed: () => {
          setRealtimeStatus('idle');
        },
        onConnectionChange: (connected) => {
          if (!connected && useRealtimeStore.getState().status !== 'idle') {
            setRealtimeStatus('error');
          }
        },
      });

      await realtimeService.connect({
        language: config.language,
        responseLanguage: config.responseLanguage,
        purpose: config.purpose,
      });
      
    } catch (error: any) {
      console.error('[Realtime] Connection failed:', error);
      setError(error.message || '서버 연결에 실패했습니다.');
      setRealtimeStatus('error');
    }
  };

  const disconnectRealtime = () => {
    realtimeService.disconnect();
    setRealtimeStatus('idle');
    setSessionId(null);
  };
  ===== Realtime 기능 보류 끝 ===== */

  // Idle 상태: 녹음 시작 버튼
  if (status === 'idle') {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-6">
        {/* 녹음 시작 버튼 */}
        <button
          onClick={onStart}
          className="group relative flex flex-col items-center gap-3 transition-transform hover:scale-105"
        >
          <div className="w-28 h-28 flex items-center justify-center bg-gradient-to-br from-primary-500 to-primary-700 rounded-full shadow-lg group-hover:shadow-xl transition-shadow">
            <FaMicrophone className="w-14 h-14 text-white" />
          </div>
          <span className="text-lg font-semibold text-gray-800">
            녹음 시작
          </span>
        </button>
      </div>
    );
  }

  // 녹음 중 상태
  return (
    <div className="flex flex-col h-full">
      {/* 녹음 상태 및 타이머 */}
      <div className="flex flex-col items-center py-4 border-b border-gray-100">
        <div className="text-center mb-3">
          <div className="text-4xl font-bold text-gray-800">{duration}</div>
        </div>

        <div className="flex items-center gap-4">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-50 rounded-full">
            <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse"></div>
            <span className="text-red-600 font-medium text-sm">녹음 중</span>
          </div>
          
          <button
            onClick={onStop}
            className="w-12 h-12 flex items-center justify-center bg-red-500 hover:bg-red-600 rounded-full shadow-lg transition-colors"
            title="Stop"
          >
            <FaStop className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('memo')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'memo'
              ? 'text-primary-600 border-b-2 border-primary-500 bg-primary-50/50'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          <FaStickyNote className="w-4 h-4" />
          <span>메모</span>
        </button>
        <button
          onClick={() => setActiveTab('realtime')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'realtime'
              ? 'text-primary-600 border-b-2 border-primary-500 bg-primary-50/50'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          <FaRobot className="w-4 h-4" />
          <span>AI 노트</span>
        </button>
      </div>

      {/* 탭 컨텐츠 */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'memo' ? (
          <MemoTab isRecording={isRecording} currentDuration={duration} />
        ) : (
          /* Realtime 기능 보류 - 개발중 메시지 표시 */
          <div className="flex flex-col items-center justify-center h-full p-6 text-center">
            <FaRobot className="w-12 h-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">
              🚧 개발 중
            </h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              AI 노트 기능은 현재 개발 중입니다.<br />
              곧 사용하실 수 있습니다!
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecordButton;
