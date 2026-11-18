# 흙별 | SANDSTAR

픽셀 샌드박스 게임 **《흙별》(SANDSTAR)**의 비공개 개발 저장소.

- 운영 사이트: https://sandstar.aldol.app/
- 기획·빌드·QA 원본: [흙별 Google Drive](https://drive.google.com/drive/folders/1AEIw-oqKb_5Dzv2ynVpM8ZQj_m4IRNb1)
- 현황과 근거: [docs/STATUS.md](docs/STATUS.md)
- 개발·릴리스 절차: [docs/OPERATIONS.md](docs/OPERATIONS.md)
- 운영 소스 이관 체크리스트: [docs/SOURCE_IMPORT.md](docs/SOURCE_IMPORT.md)

> **중요:** 현재 GitHub는 개발 관리 체계를 준비하는 단계입니다. 이 저장소의 코드와 `main`이 Cloudflare 운영본과 일치한다는 검증은 아직 없습니다. 운영 반영은 GitHub에 커밋/PR을 작성하는 행위와 별개입니다.

## 개발 운영 원칙

1. 비공개 저장소 유지. 기능 변경은 별도 브랜치와 Pull Request로 검토.
2. 배포 중인 Cloudflare Worker 및 사용자 세이브 데이터는 자동으로 변경하지 않음.
3. CI 자동 실행이나 GitHub → Cloudflare 자동 배포는 도입하지 않음. 필요한 검사는 명시적으로 수동 수행.
4. 검증된 소스와 실제 배포의 연결 관계(빌드·SHA-256·Worker 버전·QA)를 기록.
5. 과거 로컬 QA 빌드, 개발 후보, 운영본을 서로 혼동하지 않음.

## 다음 단계

[운영 소스 이관](docs/SOURCE_IMPORT.md)을 먼저 완료한 뒤 게임 통합·QA 작업을 진행합니다. 라이선스 및 배포 권한이 확인되지 않은 음원·폰트·이미지 원본이나 인증정보는 업로드하지 않습니다.
