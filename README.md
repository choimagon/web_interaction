# prism — Color in space.

멀리 펼쳐진 은하와 넓은 어둠을 배경으로, 부드럽게 확산되는 컬러 연기를 그리는 반응형 캔버스입니다. 화면에는 캔버스와 하단 조작 바만 표시합니다.

React + Tailwind CSS + Motion을 사용하며, `index.html`이 Vite의 진입점입니다. 연기는 WebGL 유체 시뮬레이션으로 구현했고, 지원하지 않는 환경에서는 Canvas 2D 효과로 전환합니다.

Tizen 등 내장 브라우저의 호환성을 위해 Tailwind CSS 3.4와 Chromium 63을 기준으로 빌드합니다. 캔버스 표시 영역은 전체 화면으로 유지하며, Pointer Events가 없으면 기존 마우스·터치 이벤트를 사용합니다. 실제 기기와 펌웨어별 동작은 해당 기기에서 확인해야 합니다.

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
