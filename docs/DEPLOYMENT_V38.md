# 흙별 Worker v38 배포 기준

2026-11-23 KST 기준으로 확인한 흙별 본게임의 운영 배포 기록입니다.

| 항목 | 확인값 |
| --- | --- |
| 운영 사이트 | [sandstar.aldol.app](https://sandstar.aldol.app/) |
| Cloudflare Worker | `sandstar` |
| Worker 버전 | `v38` |
| 버전 ID | `052cb034-a10f-49fa-b6c3-4cafd2d7ede9` |
| 배포 시각 | 2026-11-23 08:10:49 KST |
| 조회 당시 트래픽 | 100% |
| 배포 모듈 | `main.mjs` |
| 모듈 크기 | 24,939,305바이트 |
| SHA-256 | `78b4503ad11f8944710bef061d861e95befc72b5debfc719e205c6c02c60ed07` |

Cloudflare에서 읽은 Worker 모듈 바이트의 SHA-256과 크기가 릴리스 매니페스트의 기록과 일치합니다. 배포 모듈은 Phase 0 패치가 적용된 빌드로, 팀 릴리스 보관소에 있습니다. [복구 기록](STATUS.md)은 초기 복구 시점의 자료입니다.

## 검증과 소스 이관

- 운영 릴리스 매니페스트에는 Phase 0 QA 43/43 통과가 기록돼 있습니다. 실기기 터치 및 보고된 간헐적 무응답 원인은 미확인 상태입니다.
- 배포 모듈에 내장된 외부 에셋의 공개 재배포 범위를 확인 중입니다. GitHub 게임 소스 이관과 v38의 재빌드 검증은 진행 중입니다.
- 적용 패치와 빌드 입력을 확보하면 [운영 소스 이관 체크리스트](SOURCE_IMPORT.md)에 따라 비교합니다. [PR #8](https://github.com/aldol2678/sandstar/pull/8)은 v22 출처 감사 기록으로 참고합니다.
