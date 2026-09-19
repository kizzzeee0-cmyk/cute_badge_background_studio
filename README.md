# Cute Badge Background Studio v1.0

SOOP/방송용 293×164 썸네일에 어울리는 귀여운 배경 도형과 장식 요소를 빠르게 만드는 **정적 웹 앱**입니다.
빌드 과정과 서버가 필요 없어서 GitHub Pages / Cloudflare Pages에 그대로 업로드할 수 있습니다.

## 주요 기능

- 고정 출력 크기: 293×164 px
- 16종 배경 도형: 둥근 네모, 말랑 네모, 아치형, 가로 하트, 타원, 구름, 파도, 블롭, 티켓, 배지, 파스텔 붓 등
- 12종 스탬프: 하트, 선 하트, 별, 반짝이, 원, 링, 꽃, 꼬불선, 빛살 등
- 오브젝트 자유 이동 / 크기 / 회전 / 레이어 순서 조절
- 단색 / 선형 그라데이션 / 원형 그라데이션 / 파스텔 브러시 질감
- 그라데이션 방향 + 시작/끝 범위
- 다중 획 추가 / 색상 / 두께 / 순서 변경
- 방향성 어두운 음영 효과
- 작은 땡땡이 / 사선 / 체크 / 반짝이 내부 패턴
- 직선/곡선 보정이 가능한 점선 펜
- 8종 빠른 컬러 프리셋
- 실행 취소 / 다시 실행
- 프로젝트 JSON 저장/불러오기
- 정확한 293×164 PNG 및 SVG 저장
- 격자 / 안전영역 / 2px 스냅 / 화면 확대축소

## GitHub Pages

1. 이 폴더 안의 파일을 GitHub 저장소 루트에 업로드합니다.
2. GitHub 저장소의 **Settings → Pages**로 이동합니다.
3. **Deploy from a branch** 선택 후 `main` / `/ (root)`를 선택합니다.
4. 저장하면 정적 사이트로 바로 실행됩니다.

## Cloudflare Pages

### GitHub 연결 방식
- Cloudflare → Workers & Pages → Create → Pages → Connect to Git
- 이 저장소를 연결
- Framework preset: **None**
- Build command: **비워 둠**
- Build output directory: **/** 또는 저장소 루트

### Direct Upload
이 폴더 자체 또는 압축을 해제한 파일들을 Pages Direct Upload에 올려도 됩니다.

## 파일 구조

- `index.html` : UI
- `style.css` : 디자인
- `app.js` : SVG 에디터 / 내보내기 / 저장 기능
- `.nojekyll` : GitHub Pages에서 그대로 정적 배포

## 참고

모든 기능은 브라우저 안에서 동작하며 이미지를 외부 서버로 업로드하지 않습니다. 최신 Chrome/Edge 권장.
