# 짤·카드 스튜디오

이미지와 문구를 조합해 밈·카드·SNS 게시용 이미지를 만들고 PNG/JPEG 파일로 내려받는 무로그인 정적 웹앱입니다.

## 주요 기능

- PNG / JPEG 실제 파일 시그니처 검사 후 불러오기
- 지원하지 않거나 손상된 파일 거부 + 기존 편집 상태 유지
- 문구 위치(X/Y), 크기, 색, 정렬 즉시 미리보기
- 1:1 / 4:5 / 9:16 화면비
- 같은 Canvas를 미리보기와 다운로드에 사용
- 한글·영문·줄바꿈·이모지 대응 글자 단위(그래핌) 줄바꿈
- 템플릿 생성 / 불러오기 / 수정 / 삭제
- localStorage를 이용한 새로고침 후 템플릿 유지
- JSON 내보내기 / 원자적(전체 검증 후) 가져오기
- 이미지 출처와 사용 허가 근거 기록 필드
- Canvas 재인코딩으로 원본 EXIF/GPS 메타데이터를 완성 파일에 복사하지 않음

## 실행

정적 파일만 사용하므로 `index.html`을 직접 열거나 로컬 서버로 실행할 수 있습니다.

```bash
python -m http.server 8000
```

브라우저에서 `http://localhost:8000` 접속.

## GitHub Pages 배포

1. 새 Public 저장소를 만듭니다.
2. 이 폴더의 파일 전체를 저장소 루트에 올립니다.
3. GitHub 저장소 → Settings → Pages로 이동합니다.
4. Source를 `Deploy from a branch`, Branch를 `main`, Folder를 `/(root)`로 선택하고 저장합니다.
5. 생성된 `https://사용자명.github.io/저장소명/` 주소를 시크릿 창에서 확인합니다.

## 과제 증거 파일

- `evidence/test-cases.md` : 극단 입력 12건 + 대표 결함 수정 전/후
- `evidence/test-results.md` : 자동 브라우저 검사 40건 결과
- `evidence/json-tests.md` : 정상 / 문법 손상 / 필수 누락 JSON 검사
- `evidence/final-images.md` : 완성 이미지 3개 기록
- `evidence/public-safety.md` : 공개 안전 확인표
- `evidence/submission.txt` : 최종 제출문 템플릿
- `evidence/import-valid.json` : 정상 JSON
- `evidence/import-malformed.json` : 문법 손상 JSON
- `evidence/import-missing-field.json` : 필수 항목 누락 JSON

## 테스트 자산

`test-assets/`의 이미지는 프로젝트 검사용으로 코드에서 직접 생성한 단순 도형 이미지이며 외부 사진·저작물을 사용하지 않습니다.

## 완성 이미지

`output/`에 1:1, 4:5, 9:16 샘플 완성 이미지가 들어 있습니다. 실제 제출 시 본인이 사용한 최종 이미지로 교체해도 됩니다.
