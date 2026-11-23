# 요리 장면 3D 재료 GLB (흙별 코어 최적화본에서 3종만)

`ARAM-봇-공유/Sandstar-코어-에셋-최적화-20261123`(794개) 가운데 요리 재료 3종만 가져왔습니다. 품종은 모아가 Blender 렌더로 대조해 확정했습니다(Drive `05_GLB-IDENTIFIED.md`).

| 파일 | 원본 | 재료 | 크기 | tris |
| --- | --- | --- | --- | --- |
| `wheat-crop-c073.glb` | `crop-c073.glb` | 밀 이삭 단품 | 423,652B | 3,868 |
| `potato-crop-c047.glb` | `crop-c047.glb` | 감자 | 338,748B | 4,167 |
| `carrot-crop-carrot.glb` | `crop-carrot.glb` | 당근 | 257,908B | 4,152 |

- 물고기는 P5 3종에 맞는 GLB가 없어 2D 스프라이트(P5)를 씁니다. 품종은 지어내지 않습니다.
- 밀 `crop-c072`(다발)와 `crop-c075`(보리 추정)는 쓰지 않습니다.
- 라이선스: 농작물 ZIP의 LICENSE는 "AI 학습용 사용 금지"입니다. 게임 에셋 용도로만 사용합니다.
- 압축 확장 없음(KHR/Draco 미사용), JPEG 텍스처 내장 → v38에 내장된 `GLTFLoader`(three r160)로 그대로 읽습니다.
