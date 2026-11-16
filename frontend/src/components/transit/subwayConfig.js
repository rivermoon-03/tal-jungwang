// 역별 노선과 방면. key 는 /subway/next, /subway/timetable 응답 필드명이다.
export const SUBWAY_STATIONS = ['정왕', '초지', '시흥시청']

export const SUBWAY_LINES = {
  정왕: [
    {
      line: '4호선',
      dirs: [
        { key: 'line4_up', label: '서울 방면', rt: '상행' },
        { key: 'line4_down', label: '오이도 방면', rt: '하행' },
      ],
    },
    {
      line: '수인분당선',
      dirs: [
        { key: 'up', label: '왕십리 방면', rt: '상행' },
        { key: 'down', label: '인천 방면', rt: '하행' },
      ],
    },
  ],
  초지: [
    {
      line: '서해선',
      dirs: [
        { key: 'choji_up', label: '소사 방면', rt: '상행' },
        { key: 'choji_dn', label: '원시 방면', rt: '하행' },
      ],
    },
  ],
  시흥시청: [
    {
      line: '서해선',
      dirs: [
        { key: 'siheung_up', label: '소사 방면', rt: '상행' },
        { key: 'siheung_dn', label: '원시 방면', rt: '하행' },
      ],
    },
  ],
}

export function findDir(key) {
  for (const station of SUBWAY_STATIONS) {
    for (const l of SUBWAY_LINES[station]) {
      const dir = l.dirs.find((d) => d.key === key)
      if (dir) return { station, line: l.line, ...dir }
    }
  }
  return null
}
