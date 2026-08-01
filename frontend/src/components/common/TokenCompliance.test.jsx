/**
 * common/ 컴포넌트 고유 회귀 테스트
 *
 * text-gray-*, bg-gray-*, 12px 미만 폰트 금지는 src/tokenRules.test.js가
 * src/ 전체를 순회하며 이미 검사한다(이 파일이 예전에 따로 두던 중복
 * 검사는 제거했다). 여기엔 그 전역 규칙으로 커버되지 않는 고유 검증만 남긴다.
 *
 * 검증 항목:
 * - ErrorState onRetry 버튼 존재
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// ESM에는 __dirname이 없다. 파일 기준 경로는 import.meta.url에서 얻는다.
const __dirname = path.dirname(fileURLToPath(import.meta.url))

const COMPONENTS_DIR = path.resolve(__dirname, '..')

function readFile(name) {
  return fs.readFileSync(path.join(COMPONENTS_DIR, name), 'utf8')
}

describe('ErrorState onRetry 버튼', () => {
  it('ErrorState.jsx: onRetry prop 사용 코드 존재', () => {
    const src = readFile('ui/ErrorState.jsx')
    expect(src).toMatch(/onRetry/)
  })

  it('ErrorState.jsx: onRetry 버튼 렌더링 조건 존재', () => {
    const src = readFile('ui/ErrorState.jsx')
    // onRetry && <button ... 또는 {onRetry && ( 패턴
    expect(src).toMatch(/onRetry\s*&&/)
  })
})
