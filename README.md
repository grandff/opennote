# Audio Record & Transcription Chrome Extension

브라우저에서 재생되는 오디오를 녹음하고, 음성을 텍스트로 변환(Transcription)한 후 요약(Summary)하는 크롬 익스텐션입니다.

## 주요 기능

- 🎙️ 브라우저 탭 오디오 녹음
- 📝 녹음 중 텍스트 메모 입력
- 🤖 AI 기반 음성-텍스트 변환 (OpenAI Whisper)
- 📊 텍스트 자동 요약 (GPT-4)
- 💾 녹음 히스토리 관리

## 개발 환경 설정

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

프로젝트 루트에 `.env` 파일을 생성하고 OpenAI API 키를 설정합니다:

```bash
# .env 파일 생성
VITE_OPENAI_API_KEY=sk-your-actual-api-key-here
```

**⚠️ 중요**: 
- `.env` 파일은 `.gitignore`에 포함되어 있어 Git에 커밋되지 않습니다.
- API 키는 프로덕션 환경에서는 백엔드 프록시 서버를 통한 호출을 강력히 권장합니다.
- 보안 고려사항은 [SECURITY_NOTES.md](./docs/dev/phases/phase3/SECURITY_NOTES.md)를 참조하세요.

### 3. 개발 서버 실행

```bash
npm run dev
```

### 4. 빌드

```bash
npm run build
```

## Chrome에 익스텐션 로드

1. Chrome에서 `chrome://extensions/` 접속
2. 우측 상단의 "개발자 모드" 활성화
3. "압축해제된 확장 프로그램을 로드합니다" 클릭
4. 프로젝트의 `dist` 폴더 선택

## 기술 스택

- TypeScript
- React 18
- Vite
- Tailwind CSS
- Zustand
- OpenAI API (Whisper & GPT)

## 📚 문서

### 개발 문서
- [**전체 워크플로우**](./docs/dev/WORKFLOW.md) - Phase 1~8 개발 프로세스
- [**설치 가이드**](./docs/dev/guides/SETUP_GUIDE.md) - 프로젝트 설치 및 실행
- [**테스트 가이드**](./docs/dev/guides/TEST_GUIDE.md) - 익스텐션 테스트 방법

### Phase 문서
- [**Phase 2 완료**](./docs/dev/phases/phase2/PHASE2_COMPLETE.md) - 오디오 녹음 기능
- [**Phase 3 보안 고려사항**](./docs/dev/phases/phase3/SECURITY_NOTES.md) - STT 기능 보안

### 문서 인덱스
- [**전체 문서 목록**](./docs/README.md) - 모든 문서 보기

## 프로젝트 구조

```
extension-audio-record/
├── docs/                   # 📚 문서
│   ├── dev/               # 개발 문서
│   │   ├── phases/        # Phase별 문서
│   │   ├── guides/        # 개발 가이드
│   │   └── WORKFLOW.md    # 전체 워크플로우
│   └── prod/              # 프로덕션 문서
├── src/
│   ├── background/        # Background Script (Service Worker)
│   ├── popup/             # Side Panel UI
│   ├── offscreen/         # Offscreen Document (녹음 처리)
│   ├── services/          # 서비스 레이어 (STT, 녹음 등)
│   ├── stores/            # 상태 관리 (Zustand)
│   └── utils/             # 유틸리티 함수
├── public/                # 정적 파일
└── dist/                  # 빌드 출력 (Git 제외)

```
