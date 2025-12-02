// Chrome Extension 메시지 타입 정의
export interface ChromeMessage {
  type: string;
  payload?: any;
}

export interface StartRecordingMessage extends ChromeMessage {
  type: 'START_RECORDING';
  payload: {
    tabId: number;
  };
}

export interface StopRecordingMessage extends ChromeMessage {
  type: 'STOP_RECORDING';
}

export interface RecordingDataMessage extends ChromeMessage {
  type: 'RECORDING_DATA';
  payload: {
    audioBlob: Blob;
    duration: number;
  };
}

export type ExtensionMessage = 
  | StartRecordingMessage 
  | StopRecordingMessage 
  | RecordingDataMessage;



