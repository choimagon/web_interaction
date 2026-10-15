# prism — Color in space.

어두운 푸른 은하 배경 위에 부드럽게 확산되는 컬러 연기를 그리는 반응형 캔버스입니다. 화면에는 캔버스와 하단 조작 바만 표시합니다.

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

- 경로: `public/images/galaxy.png`
- 제작: 내장 imagegen 도구, 사용자 참고 이미지를 바탕으로 별 밀도를 줄인 은하 배경.
- 최종 프롬프트:

> Edit the supplied galaxy reference into a wide 16:9 website background. Keep the deep navy and soft blue Milky Way feeling, but use far fewer stars, only about 100 sparse tiny points across the whole image. Soft cyan nebula, darker open areas for colorful interactive gel to stand out. No text, no planets, no interface.
