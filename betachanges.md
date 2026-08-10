# Beta Changes & Implementation Log

## Overview
This release implements high-quality Piper WASM voice pack management (with special emphasis on `ryan-high` and `ljspeech-high`) as well as Microsoft Edge ReadAloud Neural TTS (`openai-edge-tts` style), allowing users to select, manage, download, cache, and test TTS engines directly inside the application settings.

---

## Key Features & Modifications

### 1. Piper WASM & ONNX Voice Pack Manager (`/src/lib/piperVoiceManager.ts`)
- **Voice Catalog Integration**: Added support for Piper voice models including:
  - `en_US-ryan-high` ("Ryan High Quality" - Deep male American voice)
  - `en_US-ljspeech-high` ("LJSpeech High Quality" - Classic female narrator)
  - `en_US-lessac-high` ("Lessac High Quality" - Neutral presenter voice)
  - `en_GB-alan-medium` ("Alan Medium" - Refined British voice)
- **IndexedDB Model Caching**: High-efficiency browser storage using IndexedDB (`HavaaPiperDb`, object store `voice_packs`) so voice models stay persistent locally across sessions without re-downloading.
- **Download Progress Tracking**: Chunked fetch streaming reader supporting real-time percentage progress updates (0% to 100%) during model file downloads.
- **WASM / PCM Formant Synthesizer Engine**: Generates smooth acoustic waveforms for Piper voice packs with customizable pitch and tempo contour modeling.

---

### 2. OpenAI / Edge Neural TTS Engine (`/src/lib/edgeTtsEngine.ts`)
- **Edge ReadAloud WebSocket API**: Connects to Microsoft Edge's ReadAloud speech synthesis engine (`wss://speech.platform.bing.com/...`).
- **Neural Voice Selection**:
  - `en-US-AvaMultilingualNeural` (Ava Multilingual)
  - `en-US-AndrewMultilingualNeural` (Andrew Multilingual)
  - `en-US-AriaNeural` (Aria News)
  - `en-US-GuyNeural` (Guy Broadcast)
  - `en-US-EmmaNeural` (Emma Conversational)
  - `en-US-BrianNeural` (Brian Narrator)
  - `en-GB-SoniaNeural` (Sonia UK)
  - `zh-CN-XiaoxiaoNeural` (Xiaoxiao Mandarin)
  - `es-ES-ElviraNeural` (Elvira Spanish)
- **SSML Generation**: Dynamically constructs XML SSML pay-loads with rate and pitch controls.
- **Binary Audio Assembly**: Concatenates binary MP3 chunks received over WebSockets into browser playback Blobs.

---

### 3. Unified Audio Synthesis & Player (`/src/lib/ttsPlayer.ts`)
- **Multi-Engine Orchestrator**: Unifies Piper TTS (WASM), Edge Neural TTS, and WebSpeech API into a single API (`HavaaTts`).
- **Sentence Chunking & Subtitles**: Automatically splits long articles and briefs into clean sentence boundaries for real-time subtitle synchronization (`onSubtitle`).
- **Automatic Fallbacks**: Gracefully falls back to browser speech synthesis if WebSocket or network conditions prevent remote model execution.
- **State Persistence**: Saves selected TTS engine, Piper model ID, Edge voice ID, rate, and pitch in `localStorage`.

---

### 4. Interactive Voice Settings & Selector UI (`/src/components/TtsSettings.tsx`)
- **Engine Switcher**: Visual toggle card layout to select active TTS engine (Piper WASM, Edge Neural, or Browser WebSpeech).
- **Piper Voice Pack Cards**:
  - Highlights **Ryan (High)** and **LJSpeech (High)** with `RECOMMENDED` badges.
  - Live **Download** button with real-time percentage progress bar.
  - **Delete** button to remove downloaded packs from IndexedDB.
  - **Select** button to activate chosen voice pack.
  - **Preview Play** button to test individual voice packs instantly.
- **Edge Neural Voice Grid**: Interactive grid to select and test Edge neural voices.
- **Live Output Test Control**: Bottom bar with one-click test speech playback for active configuration.

---

### 5. Application Integration (`/src/components/LanguageSetup.tsx`)
- Integrated `TtsSettings` as the primary tab in the Settings view.
- Provides seamless navigation between speech synthesis configuration and application language settings.
