import React, { useState, useEffect } from 'react';
import { STORAGE_KEYS } from '@/utils/constants';

const Options: React.FC = () => {
  const [apiKey, setApiKey] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // 저장된 API 키 불러오기
    chrome.storage.local.get([STORAGE_KEYS.API_KEY], (result) => {
      if (result[STORAGE_KEYS.API_KEY]) {
        setApiKey(result[STORAGE_KEYS.API_KEY]);
      }
    });
  }, []);

  const handleSave = () => {
    chrome.storage.local.set({ [STORAGE_KEYS.API_KEY]: apiKey }, () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-md p-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">Settings</h1>

        <div className="space-y-6">
          {/* API Key 설정 */}
          <div>
            <label
              htmlFor="apiKey"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              OpenAI API Key
            </label>
            <input
              type="password"
              id="apiKey"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            <p className="mt-2 text-sm text-gray-500">
              Transcription과 Summary 기능을 사용하려면 OpenAI API 키가 필요합니다.
            </p>
          </div>

          {/* 저장 버튼 */}
          <div className="flex items-center gap-4">
            <button
              onClick={handleSave}
              className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors"
            >
              Save
            </button>

            {saved && (
              <span className="text-green-600 font-medium">
                ✓ Saved successfully
              </span>
            )}
          </div>

          {/* 안내 */}
          <div className="mt-8 p-4 bg-blue-50 rounded-lg">
            <h3 className="font-semibold text-blue-900 mb-2">
              OpenAI API 키 발급 방법
            </h3>
            <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
              <li>
                <a
                  href="https://platform.openai.com/api-keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-blue-600"
                >
                  OpenAI Platform
                </a>
                에 접속
              </li>
              <li>로그인 또는 회원가입</li>
              <li>"Create new secret key" 클릭</li>
              <li>생성된 API 키를 복사하여 위에 입력</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Options;



