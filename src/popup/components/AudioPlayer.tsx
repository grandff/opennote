import React, { useRef, useState, useEffect } from 'react';
import { FaPlay, FaPause, FaRedo } from 'react-icons/fa';
import { formatDuration } from '@/utils/timeUtils';

interface AudioPlayerProps {
  audioUrl: string;
  duration: number;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ audioUrl, duration }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(duration);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // 오디오 메타데이터 로드 시 실제 duration 가져오기
    const handleLoadedMetadata = () => {
      console.log('Audio loaded, duration:', audio.duration);
      if (audio.duration && isFinite(audio.duration) && !isNaN(audio.duration)) {
        setAudioDuration(Math.floor(audio.duration));
      } else {
        // duration이 유효하지 않으면 prop으로 받은 duration 사용
        console.warn('Invalid audio duration:', audio.duration, 'Using prop duration:', duration);
        if (duration && isFinite(duration)) {
          setAudioDuration(duration);
        }
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    // 오디오 URL 변경 시 duration 재설정
    if (audioUrl) {
      audio.load();
    }

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [audioUrl]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleRestart = () => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.currentTime = 0;
    setCurrentTime(0);
    audio.play();
    setIsPlaying(true);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;

    const newTime = parseFloat(e.target.value);
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  // duration prop이 변경되면 업데이트 (하지만 실제 오디오 duration 우선)
  useEffect(() => {
    if (duration && !audioDuration) {
      setAudioDuration(duration);
    }
  }, [duration]);

  return (
    <div className="w-full p-6 bg-gray-50 rounded-lg">
      <audio ref={audioRef} src={audioUrl} />

      {/* 재생 시간 표시 */}
      <div className="flex justify-between items-center mb-4">
        <span className="text-lg font-semibold text-gray-700">
          {formatDuration(currentTime)}
        </span>
        <span className="text-sm text-gray-500">
          {formatDuration(audioDuration)}
        </span>
      </div>

      {/* 진행 바 */}
      <input
        type="range"
        min="0"
        max={audioDuration || duration}
        value={currentTime}
        onChange={handleSeek}
        className="w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer mb-6"
        style={{
          background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${audioDuration > 0 ? (currentTime / audioDuration) * 100 : 0}%, #d1d5db ${audioDuration > 0 ? (currentTime / audioDuration) * 100 : 0}%, #d1d5db 100%)`,
        }}
      />

      {/* 컨트롤 버튼 */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={handleRestart}
          className="p-3 text-gray-600 hover:text-primary-600 hover:bg-gray-200 rounded-full transition-colors"
          title="Restart"
        >
          <FaRedo className="w-5 h-5" />
        </button>

        <button
          onClick={togglePlay}
          className="p-4 bg-primary-600 hover:bg-primary-700 text-white rounded-full shadow-lg transition-colors"
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <FaPause className="w-6 h-6" />
          ) : (
            <FaPlay className="w-6 h-6 ml-1" />
          )}
        </button>
      </div>
    </div>
  );
};

export default AudioPlayer;

