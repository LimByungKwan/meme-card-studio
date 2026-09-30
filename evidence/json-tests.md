# JSON 가져오기 검사

## 1. 정상 JSON

파일: `import-valid.json`

예상: 전체 검증 후 템플릿 목록이 복원되고 성공 메시지가 표시됩니다.

## 2. 문법 손상 JSON

파일: `import-malformed.json`

예상: `JSON.parse` 단계에서 거부되고 기존 템플릿 수와 내용이 그대로 유지됩니다.

## 3. 필수 항목 누락 JSON

파일: `import-missing-field.json`

예상: `textX` 등 필수 항목 검증에서 거부되고 기존 템플릿 수와 내용이 그대로 유지됩니다.

## 저장 안전 방식

가져온 데이터를 먼저 메모리에서 전부 검증한 뒤, 모든 템플릿이 통과했을 때만 `localStorage`를 교체합니다. 따라서 중간 실패가 기존 목록을 지우지 않습니다.
