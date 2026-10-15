# prism — Color in space.

멀리 펼쳐진 은하와 넓은 어둠을 배경으로, 부드럽게 확산되는 컬러 연기를 그리는 반응형 캔버스입니다. 화면에는 캔버스와 하단 조작 바만 표시합니다.

React + Tailwind CSS + Motion을 사용하며, `index.html`이 Vite의 진입점입니다. 연기는 WebGL 유체 시뮬레이션으로 구현했고, 지원하지 않는 환경에서는 Canvas 2D 효과로 전환합니다.

Tizen 등 내장 브라우저의 호환성을 위해 Tailwind CSS 3.4와 Chromium 63을 기준으로 빌드합니다. 캔버스 표시 영역은 전체 화면으로 유지하며, Pointer Events가 없으면 기존 마우스·터치 이벤트를 사용합니다. 실제 기기와 펌웨어별 동작은 해당 기기에서 확인해야 합니다.

## 기술 구성과 선택 이유

조작부는 React로 구성하고, 연기의 흐름은 별도의 그래픽 엔진에서 계산합니다. 화면 설정과 매 프레임의 그래픽 처리를 분리해 역할을 명확하게 유지합니다.

| 기술 | 적용한 부분 | 선택 이유 |
| --- | --- | --- |
| React + JavaScript | 색상 선택, 굵기 조절, 자동 재생, 초기화, 전체 화면 버튼 | 사용자가 선택한 설정과 버튼 상태를 화면에 일관되게 반영하고, 조작부를 컴포넌트로 관리하기 위해 사용합니다. |
| Tailwind CSS + 직접 작성한 CSS | 기본 배치, 하단 툴바, 색상 팔레트, 반응형 화면 | 기본 배치는 유틸리티 클래스로 구성하고, 간격·색감·투명도·슬라이더 등 세부 디자인은 CSS로 조절합니다. |
| Motion | 툴바 등장과 버튼을 누를 때의 축소 효과 | 조작에 부드러운 시각적 반응을 제공합니다. 연기 애니메이션은 별도의 그래픽 엔진이 처리합니다. |
| WebGL 2 + GLSL 셰이더 | 연기의 이동, 소용돌이, 색의 확산과 감쇠 | GPU에서 속도장과 색상장을 계산해 입력에 실시간으로 반응하는 유체 효과를 구현합니다. |
| Canvas 2D | WebGL 결과를 화면에 합성하고, WebGL을 사용할 수 없을 때 대체 효과 표시 | 표시용 캔버스를 유지하면서 그래픽 지원 수준에 따라 렌더러를 전환합니다. 대체 효과는 부드러운 입자를 이용한 간소화된 연기입니다. |
| Vite + PostCSS·Autoprefixer | 개발 서버, 배포용 빌드, CSS 처리 | 개발 중 변경 사항을 확인하고 배포 파일을 생성합니다. Tailwind CSS 처리와 브라우저별 CSS 접두사 추가를 자동화합니다. |

## 화면 디자인

- **어두운 배경과 넓은 여백:** 은하 PNG 이미지 위에 어두운 그라데이션과 가장자리 음영을 겹쳐 컬러 연기에 시선이 모이도록 합니다.
- **반투명 하단 툴바:** 배경 흐림 효과(`backdrop-filter`), 얇은 테두리, 은은한 그림자로 조작부가 배경과 자연스럽게 어울리도록 합니다.
- **일관된 조작부:** 버튼 크기, 여백, SVG 아이콘의 선 두께를 통일하고, 선택한 색상에는 테두리와 체크 표시를 함께 제공합니다.
- **화면 크기에 맞는 배치:** 모바일에서는 툴바를 두 줄로 배치하고 굵기 슬라이더를 넓힙니다. 큰 화면과 높이가 낮은 화면에도 별도 스타일을 적용합니다.

## 동작 구조와 성능

1. [App.jsx](src/App.jsx)에서 색상·굵기·자동 재생 상태를 관리하고 엔진에 전달합니다.
2. [SmokeEngine.js](src/SmokeEngine.js)에서 마우스·터치·키보드 입력을 받아 연기의 위치와 힘으로 변환하고, `requestAnimationFrame`으로 화면을 갱신합니다.
3. [WebGLFluid.js](src/WebGLFluid.js)에서 속도·압력·소용돌이를 계산하고 색을 이동·확산시킵니다. 결과는 표시용 Canvas 2D에 그립니다.

- **React와 그래픽 갱신 분리:** 매 프레임의 시뮬레이션 값을 React 상태에 넣지 않고 엔진 내부에서 처리합니다.
- **계산량 조절:** 모바일에서는 시뮬레이션과 색상 텍스처의 해상도, 압력 계산 반복 횟수를 낮춥니다. 표시용 캔버스의 내부 해상도에도 상한을 둡니다.
- **불필요한 처리 줄이기:** 탭이 숨겨지면 애니메이션 루프를 멈춥니다. 입력 간격과 한 번에 처리할 연기 생성 요청 수를 제한합니다.
- **그래픽 기능 대응:** WebGL 초기화 실패, 크기 변경 중 오류, 그래픽 컨텍스트 손실 시 Canvas 2D 대체 효과로 전환합니다.
- **입력과 접근성:** Pointer Events를 우선 사용하고, 지원하지 않으면 마우스·터치 이벤트를 사용합니다. 키보드 조작, 상태 안내, 사용자의 동작 줄이기 설정도 반영합니다.

## 로컬 실행

Node.js 22.12 이상에서 실행하세요.

```sh
npm install
npm run dev
```

접속: http://localhost:5173

## 사용 방법

- 클릭 없이 마우스를 올리고 움직여 색을 그립니다. 마우스가 머무는 곳에서도 연기가 피어납니다.
- 모바일에서는 손가락으로 터치하거나 드래그해 사용할 수 있습니다.
- 하단 **캠 OFF / ON** 버튼으로 손 인식 모드를 켜고 끕니다. OFF에서는 기존 마우스·터치 조작을 사용합니다.
- 캠 ON에서 카메라 권한을 허용하면 좌측 하단에 좌우 반전된 미리보기와 손 인식 표시가 나타납니다. **검지만 펴서 움직이면** 검지 끝을 따라 흰색 포인터가 이동하며 연기를 그립니다. 엄지는 편한 위치에 두어도 됩니다.
- **다섯 손가락을 모두 펴면** 포인터가 캔버스 가운데로 돌아오고 그리기가 멈춥니다. 다른 손 모양이나 손 인식 끊김에서도 그리기가 멈춥니다.
- 카메라는 `localhost` 또는 HTTPS에서 사용하세요. USB 카메라도 기본 영상 입력으로 사용할 수 있습니다. 캠을 끄면 카메라 트랙과 손 인식 처리를 종료합니다. 카메라 영상은 브라우저 안에서 처리하며 서버에 전송하지 않습니다.
- 빨강·파랑·노랑·초록 계열 중 하나를 선택하고 굵기를 조절합니다.
- 자동 재생으로 색의 흐름을 감상하고 초기화 버튼으로 화면을 비웁니다.
- 캔버스에 키보드 포커스를 두고 Enter 또는 스페이스를 눌러도 사용할 수 있습니다.

## 빌드

```sh
npm run build
npm run preview
```

배포용 파일은 `dist/`에 생성됩니다.

## 손 인식

[MediaPipe Hand Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker/web_js)의 `@mediapipe/tasks-vision` 1.1.1과 구형 환경용 [MediaPipe Hands](https://github.com/google-ai-edge/mediapipe/blob/master/docs/solutions/hands.md) 0.4.1675469240을 사용합니다.

| 환경 | 손 인식 경로 |
| --- | --- |
| OffscreenCanvas, Worker, WebAssembly SIMD 지원 | 별도 Worker에서 GPU 우선, 초기화 실패 시 CPU로 재시도 |
| Tizen 5.x 등 해당 기능이 없는 환경, Worker 초기화 실패 | 메인 화면의 Canvas에서 MediaPipe Hands 경량 모델(`modelComplexity: 0`). 런타임이 SIMD / 비 SIMD 바이너리를 선택 |

최대 초당 30프레임으로 한 프레임씩 처리하며 이전 영상을 대기열에 쌓지 않습니다. 검지 자세는 첫 결과부터 반영하고, 이동량이 클수록 위치 보정을 줄입니다. 손바닥 중앙 복귀는 두 프레임을 확인합니다. 실제 인식 속도는 기기 성능과 카메라 출력 속도에 따라 달라집니다.

- 공식 모델: `public/mediapipe/hand_landmarker.task` ([Google 모델 원본](https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task), Apache 2.0).
- WASM과 로더는 설치된 npm 패키지에서 Vite가 함께 제공합니다. 실행 중 외부 CDN 연결은 필요하지 않습니다.
- `npm run dev`와 `npm run build`는 `scripts/prepare-camera.mjs`로 구형 런타임을 `public/mediapipe/hands/`에 자동 복사합니다. 이 생성 폴더는 Git에서 제외하며 `npm install` 후 다시 생성됩니다.
- 캠을 사용하지 않거나 카메라를 열 수 없는 환경에서는 기존 마우스·터치 입력과 렌더러를 계속 사용합니다.

## Tizen 5.1 + USB 카메라

Chromium 63을 기준으로 앱 코드를 빌드합니다. [삼성 공식 엔진 표](https://developer.samsung.com/smarttv/develop/specifications/web-engine-specifications.html)에서 Tizen 5.0은 Chromium 63으로 안내하며, 정확한 모니터 모델과 펌웨어의 기능은 기기에서 확인해야 합니다.

1. 모니터가 지원하는 USB 카메라를 연결하고 운영체제에서 인식되는지 확인합니다.
2. 빌드 결과 전체를 HTTPS 서버에 올려 기본 브라우저에서 엽니다. 다른 기기에서 접속할 때 PC의 `localhost` 주소는 사용할 수 없습니다.
3. 캠 버튼을 켜고 카메라 권한을 허용합니다. 전면 카메라 조건을 지정하지 않아 USB 영상 입력을 사용할 수 있습니다. 구형 `webkitGetUserMedia` API만 있는 경우에도 연결을 시도합니다.
4. 설치형 Tizen 웹 앱으로 감싸는 경우 `config.xml`에 `http://tizen.org/privilege/mediacapture`를 선언해야 합니다. [Tizen 권한 문서](https://docs.tizen.org/application/web/tutorials/sec-privileges/)를 참고하세요.

손 인식에는 기기의 카메라 접근, WebAssembly, WebGL 지원이 필요합니다. 카메라 미지원 또는 권한 오류가 발생하면 안내를 표시하고 캠을 끕니다. 실기기에서 USB 카메라의 노출 여부와 인식 성능은 별도 확인이 필요합니다.

```sh
npm test
npm run build
```

## 배경 이미지

- 경로: `public/images/galaxy-vast-v2.png`
- 제작: 내장 imagegen 도구로 기존 배경을 편집. 성운을 더 멀고 가늘게 배치하고, 별과 밝기를 줄여 넓은 우주 공간을 표현합니다. CSS의 어두운 오버레이와 가장자리 음영을 함께 적용합니다.
- 최종 프롬프트:

> Edit this background into a much darker, more expansive deep-space panorama, 16:9. Pull the viewpoint far back: the blue Milky Way becomes a very distant, thin, gently diagonal ribbon, with huge near-black navy areas around it. About 80 percent of the composition is quiet open space. Keep only 35 to 50 very small, faint, widely separated stars, with subtle size variation suggesting immense depth. Preserve the blue palette but lower the nebula luminosity substantially; atmospheric and restrained, not a bright close-up cloud. No planets, text, borders, interface, or lens flares.
