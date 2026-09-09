import StatusChip from '../ui/StatusChip'
import { labelFromLevel } from '../../utils/crowdingLevel'

/**
 * CrowdedBadge — 실시간 등급(1~4) 혼잡도 칩.
 * 낱말은 utils/crowdingLevel 정본에서만 읽는다. 색은 혼잡(3) 이상에만 경고
 * 톤을 쓴다(대면적 경고색 남용 방지).
 */
export default function CrowdedBadge({ level, estimated = false }) {
  const label = labelFromLevel(level, { estimated })
  if (!label) return null
  return <StatusChip kind={level >= 3 ? 'crowded' : 'ease'}>{label}</StatusChip>
}
