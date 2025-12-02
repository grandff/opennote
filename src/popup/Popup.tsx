import React, { useState } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import RecordButton from './components/RecordButton';
import RecordingComplete from './components/RecordingComplete';
import TranscriptionScreen from './components/TranscriptionScreen';
import { useRecording } from '@/hooks/useRecording';
import useRecordingStore from '@/stores/recordingStore';

type Screen = 'recording' | 'complete' | 'transcription';

const Popup: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<Screen>('recording');
  const {
    status,
    currentRecording,
    duration,
    handleStart,
    handleStop,
    handleReset,
  } = useRecording();

  // 녹음 정지 시 완료 화면으로 전환
  const onStop = async () => {
    try {
      console.log('=== Popup: onStop called ===');
      console.log('Current status before stop:', status);
      console.log('Current recording before stop:', currentRecording);
      
      await handleStop();
      
      console.log('=== Popup: handleStop completed ===');
      
      // store에서 최신 상태 가져오기
      const updatedStatus = useRecordingStore.getState().status;
      const updatedRecording = useRecordingStore.getState().currentRecording;
      
      console.log('Updated status after stop:', updatedStatus);
      console.log('Updated recording after stop:', updatedRecording);
      console.log('Has audioBlob:', !!updatedRecording?.audioBlob);
      console.log('Has audioUrl:', !!updatedRecording?.audioUrl);
      console.log('AudioBlob size:', updatedRecording?.audioBlob?.size);
      
      if (!updatedRecording?.audioBlob) {
        console.error('❌ No audioBlob in recording after stop!');
        alert('녹음 데이터를 가져올 수 없습니다. 다시 시도해주세요.');
        return;
      }
      
      if (!updatedRecording?.audioUrl) {
        console.error('❌ No audioUrl in recording after stop!');
        alert('오디오 URL을 생성할 수 없습니다. 다시 시도해주세요.');
        return;
      }
      
      console.log('✅ All checks passed, switching to complete screen');
      setCurrentScreen('complete');
    } catch (error: any) {
      console.error('❌ Error in onStop:', error);
      console.error('Error stack:', error?.stack);
      alert(`녹음 정지 실패:\n${error?.message || '알 수 없는 오류가 발생했습니다.'}\n\n콘솔을 확인해주세요.`);
    }
  };

  // Transcription 화면으로 이동
  const onTranscribe = () => {
    setCurrentScreen('transcription');
    // TODO: Transcription 화면 구현
  };

  // 녹음 삭제
  const onDelete = () => {
    if (currentRecording?.audioUrl) {
      URL.revokeObjectURL(currentRecording.audioUrl);
    }
    handleReset();
    setCurrentScreen('recording');
  };

  // 새 녹음 시작
  const onNewRecording = () => {
    if (currentRecording?.audioUrl) {
      URL.revokeObjectURL(currentRecording.audioUrl);
    }
    handleReset();
    setCurrentScreen('recording');
  };

  // Header 액션들
  const handleProfileClick = () => {
    console.log('Profile clicked');
    // TODO: Profile 페이지로 이동
  };

  const handleSettingClick = () => {
    console.log('Setting clicked');
    chrome.runtime.openOptionsPage();
  };

  const handleHistoryClick = () => {
    console.log('History clicked');
    // TODO: History 페이지로 이동
  };

  const handlePaymentClick = () => {
    console.log('Payment clicked');
    // TODO: Payment 페이지로 이동
  };

  // Footer 액션들
  const handleRatingClick = () => {
    console.log('Rating clicked');
    window.open('https://chrome.google.com/webstore', '_blank');
  };

  const handleShareClick = () => {
    console.log('Share clicked');
    // TODO: Share 기능 구현
  };

  const handleMessageClick = () => {
    console.log('Message clicked');
    // TODO: Message 기능 구현
  };

  const handleBugReportClick = () => {
    console.log('Bug report clicked');
    window.open('https://github.com/yourusername/extension-audio-record/issues', '_blank');
  };

  return (
    <div className="w-full min-h-screen flex flex-col bg-white">
      {/* Header */}
      <Header
        onProfileClick={handleProfileClick}
        onSettingClick={handleSettingClick}
        onHistoryClick={handleHistoryClick}
        onPaymentClick={handlePaymentClick}
      />

      {/* Body */}
      <main className="flex-1 overflow-y-auto">
        {currentScreen === 'recording' && (
          <RecordButton
            status={status}
            duration={duration}
            onStart={handleStart}
            onStop={onStop}
          />
        )}

        {currentScreen === 'complete' && currentRecording && (
          <RecordingComplete
            audioUrl={currentRecording.audioUrl || ''}
            audioBlob={currentRecording.audioBlob}
            duration={currentRecording.duration}
            timestamp={currentRecording.timestamp}
            onTranscribe={onTranscribe}
            onDelete={onDelete}
            onNewRecording={onNewRecording}
          />
        )}

        {currentScreen === 'transcription' && (
          <TranscriptionScreen onBack={() => setCurrentScreen('complete')} />
        )}
      </main>

      {/* Footer */}
      <Footer
        onRatingClick={handleRatingClick}
        onShareClick={handleShareClick}
        onMessageClick={handleMessageClick}
        onBugReportClick={handleBugReportClick}
      />
    </div>
  );
};

export default Popup;

