/**
 * Realtime API 서비스
 * WebSocket을 통해 백엔드 Realtime API와 통신하여 실시간 전사/번역/요약 기능 제공
 */

import { BACKEND_API_URL } from '@/utils/constants';

export interface RealtimeConfig {
  language?: string;         // 입력 언어 (기본값: 'en')
  responseLanguage?: string; // 응답 언어 (번역/요약 결과 언어, 기본값: 'en')
  purpose?: 'summary' | 'translation'; // 처리 목적 (기본값: 'summary')
  model?: string;            // Realtime 모델 (기본값: 'gpt-4o-mini-transcribe')
}

export interface RealtimeEventHandlers {
  onTranscription?: (text: string, isDelta: boolean) => void;
  onTranslation?: (text: string, isDelta: boolean) => void;
  onSummary?: (summary: string, isDelta: boolean) => void;
  onError?: (error: string) => void;
  onSessionCreated?: (sessionId: string) => void;
  onSessionClosed?: () => void;
  onConnectionChange?: (connected: boolean) => void;
}

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error' | 'stopped';

class RealtimeService {
  private ws: WebSocket | null = null;
  private sessionId: string | null = null;
  private connectionState: ConnectionState = 'disconnected';
  private handlers: RealtimeEventHandlers = {};
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private audioQueue: string[] = [];
  private isProcessingQueue: boolean = false;
  private connectionStopped: boolean = false;

  /**
   * WebSocket 연결 및 세션 시작
   */
  async connect(config: RealtimeConfig = {}): Promise<void> {
    if (this.connectionStopped) {
      console.log('[Realtime] Connection stopped - max attempts reached. Will retry on next recording.');
      return;
    }

    if (this.connectionState === 'connecting' || this.connectionState === 'connected') {
      console.log('[Realtime] Already connected or connecting');
      return;
    }

    this.connectionState = 'connecting';
    this.handlers.onConnectionChange?.(false);

    return new Promise((resolve, reject) => {
      try {
        const wsUrl = BACKEND_API_URL.replace(/^http/, 'ws') + '/api/v1/realtime';
        console.log('[Realtime] Connecting to:', wsUrl, `(attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);
        console.log('[Realtime] Config:', config);
        
        this.ws = new WebSocket(wsUrl);

        const connectionTimeout = setTimeout(() => {
          if (this.connectionState === 'connecting') {
            console.error('[Realtime] Connection timeout');
            this.ws?.close();
            this.handleConnectionFailure(config, new Error('WebSocket connection timeout'), reject);
          }
        }, 10000);

        this.ws.onopen = () => {
          clearTimeout(connectionTimeout);
          console.log('[Realtime] WebSocket connected');
          this.connectionState = 'connected';
          this.reconnectAttempts = 0;
          this.connectionStopped = false;
          this.handlers.onConnectionChange?.(true);

          // 세션 시작 - 새로운 API 형식
          this.sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
          this.sendMessage({
            type: 'session.start',
            sessionId: this.sessionId,
            config: {
              language: config.language || 'en',
              responseLanguage: config.responseLanguage || 'en',
              purpose: config.purpose || 'summary',
              model: config.model || 'gpt-4o-mini-transcribe',
            },
          });

          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            this.handleServerMessage(message);
          } catch (error) {
            console.error('[Realtime] Error parsing message:', error);
          }
        };

        this.ws.onerror = (event) => {
          clearTimeout(connectionTimeout);
          console.error('[Realtime] WebSocket error:', event);
          this.handleConnectionFailure(config, new Error('WebSocket 연결 오류'), reject);
        };

        this.ws.onclose = (event) => {
          clearTimeout(connectionTimeout);
          console.log('[Realtime] WebSocket closed:', event.code, event.reason);
          
          if (this.connectionStopped || event.code === 1000) {
            this.connectionState = this.connectionStopped ? 'stopped' : 'disconnected';
            this.handlers.onConnectionChange?.(false);
            return;
          }

          this.connectionState = 'disconnected';
          this.handlers.onConnectionChange?.(false);
          
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect(config);
          } else {
            this.stopConnection('최대 재연결 시도 횟수에 도달했습니다.');
          }
        };
      } catch (error) {
        console.error('[Realtime] Error creating WebSocket:', error);
        this.handleConnectionFailure(config, error as Error, reject);
      }
    });
  }

  /**
   * 연결 실패 처리
   */
  private handleConnectionFailure(
    config: RealtimeConfig,
    error: Error,
    reject: (reason?: any) => void
  ): void {
    this.reconnectAttempts++;
    console.log(`[Realtime] Connection failed (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.stopConnection('연결에 5회 실패했습니다. 다시 녹음을 시작하면 재시도합니다.');
      reject(error);
    } else {
      this.connectionState = 'error';
      this.handlers.onError?.(`연결 오류 (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      this.handlers.onConnectionChange?.(false);
      this.scheduleReconnect(config);
      reject(error);
    }
  }

  /**
   * 연결 시도 완전 중단
   */
  private stopConnection(message: string): void {
    console.log(`[Realtime] Stopping connection attempts: ${message}`);
    this.connectionStopped = true;
    this.connectionState = 'stopped';
    this.handlers.onError?.(message);
    this.handlers.onConnectionChange?.(false);
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  /**
   * 서버 메시지 처리
   */
  private handleServerMessage(message: any): void {
    console.log('[Realtime] Received message:', message.type);

    switch (message.type) {
      case 'session.created':
        console.log('[Realtime] Session created:', message.sessionId);
        this.handlers.onSessionCreated?.(message.sessionId);
        break;

      case 'transcription.delta':
        if (message.data?.fullText) {
          this.handlers.onTranscription?.(message.data.fullText, true);
        }
        break;

      case 'transcription.completed':
        if (message.data?.transcript) {
          this.handlers.onTranscription?.(message.data.transcript, false);
        }
        break;

      case 'translation.delta':
        // 번역 모드: translatedText 필드
        if (message.data?.translatedText) {
          this.handlers.onTranslation?.(message.data.translatedText, true);
        }
        // 요약 모드: summary 필드
        if (message.data?.summary) {
          this.handlers.onSummary?.(message.data.summary, true);
        }
        break;

      case 'translation.completed':
        // 번역 모드: translatedText 필드
        if (message.data?.translatedText) {
          this.handlers.onTranslation?.(message.data.translatedText, false);
        }
        // 요약 모드: summary 필드
        if (message.data?.summary) {
          this.handlers.onSummary?.(message.data.summary, false);
        }
        break;

      case 'error':
        console.error('[Realtime] Server error:', message.error);
        this.handlers.onError?.(message.error);
        break;

      case 'session.closed':
        console.log('[Realtime] Session closed');
        this.handlers.onSessionClosed?.();
        break;
    }
  }

  /**
   * 재연결 스케줄링
   */
  private scheduleReconnect(config: RealtimeConfig): void {
    if (this.connectionStopped) {
      console.log('[Realtime] Connection stopped - not scheduling reconnect');
      return;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
    console.log(`[Realtime] Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);

    this.reconnectTimeout = setTimeout(async () => {
      if (this.connectionStopped) {
        console.log('[Realtime] Connection stopped during wait - aborting reconnect');
        return;
      }
      
      try {
        await this.connect(config);
      } catch (error) {
        console.error('[Realtime] Reconnect failed:', error);
      }
    }, delay);
  }

  /**
   * 메시지 전송
   */
  private sendMessage(message: object): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      // WebSocket 연결되지 않으면 무시
      return;
    }

    this.ws.send(JSON.stringify(message));
  }

  /**
   * 오디오 청크 전송
   */
  sendAudioChunk(pcmBase64: string): void {
    if (!this.sessionId) {
      // 세션이 없으면 무시 (연결 중이거나 연결 실패 상태)
      return;
    }

    this.audioQueue.push(pcmBase64);
    this.processAudioQueue();
  }

  /**
   * 오디오 큐 처리
   */
  private processAudioQueue(): void {
    if (this.isProcessingQueue || this.audioQueue.length === 0) {
      return;
    }

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      // WebSocket 연결되지 않으면 무시
      return;
    }

    this.isProcessingQueue = true;

    while (this.audioQueue.length > 0) {
      const chunk = this.audioQueue.shift();
      if (chunk) {
        this.sendMessage({
          type: 'audio.append',
          sessionId: this.sessionId,
          audio: chunk,
        });
      }
    }

    this.isProcessingQueue = false;
  }

  /**
   * 세션 종료
   */
  endSession(): void {
    if (this.sessionId && this.ws?.readyState === WebSocket.OPEN) {
      this.sendMessage({
        type: 'session.end',
        sessionId: this.sessionId,
      });
    }
  }

  /**
   * 연결 종료
   */
  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.endSession();
      this.ws.close(1000, 'Normal closure');
      this.ws = null;
    }

    this.sessionId = null;
    this.connectionState = 'disconnected';
    this.audioQueue = [];
    this.handlers.onConnectionChange?.(false);
  }

  /**
   * 상태 리셋 (새 녹음 시작 시 호출)
   */
  reset(): void {
    console.log('[Realtime] Resetting connection state');
    this.disconnect();
    this.reconnectAttempts = 0;
    this.connectionStopped = false;
    this.connectionState = 'disconnected';
  }

  /**
   * 이벤트 핸들러 설정
   */
  setHandlers(handlers: RealtimeEventHandlers): void {
    this.handlers = { ...this.handlers, ...handlers };
  }

  /**
   * 연결 상태 확인
   */
  isConnected(): boolean {
    return this.connectionState === 'connected' && this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * 세션 ID 가져오기
   */
  getSessionId(): string | null {
    return this.sessionId;
  }

  /**
   * 연결 상태 가져오기
   */
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }
}

const realtimeService = new RealtimeService();
export default realtimeService;
