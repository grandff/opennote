import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // .env 파일 로드
  const env = loadEnv(mode, process.cwd(), '');
  
  // API 키에서 따옴표 제거 (환경 변수는 따옴표 없이 저장되어야 함)
  const apiKey = (env.VITE_OPENAI_API_KEY || '').replace(/^["']|["']$/g, '').trim();
  
  // 보안: 빌드 로그에 API 키 노출 최소화 (프로덕션에서는 완전히 제거 권장)
  if (apiKey) {
    console.log('🔑 OpenAI API Key loaded (length:', apiKey.length, ')');
  } else {
    console.warn('⚠️ OpenAI API Key not found in .env file');
  }
  
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
    },
    define: {
      // 환경 변수를 빌드 시 주입
      'import.meta.env.VITE_OPENAI_API_KEY': JSON.stringify(apiKey),
      // 백엔드 API 설정 (ngrok 또는 프로덕션 URL)
      'import.meta.env.VITE_BACKEND_API_URL': JSON.stringify(env.VITE_BACKEND_API_URL || 'http://localhost:8080'),
      'import.meta.env.VITE_EXTENSION_API_KEY': JSON.stringify(env.VITE_EXTENSION_API_KEY || ''),
    },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/index.html'),
        options: resolve(__dirname, 'src/options/index.html'),
        background: resolve(__dirname, 'src/background/index.ts'),
        offscreen: resolve(__dirname, 'src/offscreen/offscreen.html'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          return chunkInfo.name === 'background'
            ? 'background.js'
            : 'assets/[name]-[hash].js';
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
        format: 'es', // ES module format
      },
    },
    target: 'esnext',
    minify: false, // 디버깅을 위해 minify 끔
  },
  };
});


