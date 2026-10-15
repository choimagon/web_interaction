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
- 빨강·파랑·노랑·초록 계열 중 하나를 선택하고 굵기를 조절합니다.
- 자동 재생으로 색의 흐름을 감상하고 초기화 버튼으로 화면을 비웁니다.
- 캔버스에 키보드 포커스를 두고 Enter 또는 스페이스를 눌러도 사용할 수 있습니다.

## 빌드

```sh
npm run build
npm run preview
```

배포용 파일은 `dist/`에 생성됩니다.

## 배경 이미지

- 경로: `public/images/galaxy-vast-v2.png`
- 제작: 내장 imagegen 도구로 기존 배경을 편집. 성운을 더 멀고 가늘게 배치하고, 별과 밝기를 줄여 넓은 우주 공간을 표현합니다. CSS의 어두운 오버레이와 가장자리 음영을 함께 적용합니다.
- 최종 프롬프트:

> Edit this background into a much darker, more expansive deep-space panorama, 16:9. Pull the viewpoint far back: the blue Milky Way becomes a very distant, thin, gently diagonal ribbon, with huge near-black navy areas around it. About 80 percent of the composition is quiet open space. Keep only 35 to 50 very small, faint, widely separated stars, with subtle size variation suggesting immense depth. Preserve the blue palette but lower the nebula luminosity substantially; atmospheric and restrained, not a bright close-up cloud. No planets, text, borders, interface, or lens flares.
