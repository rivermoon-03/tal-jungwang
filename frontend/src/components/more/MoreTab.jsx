import { useState } from 'react'
import { Megaphone, Bell, Info, MessageSquare, Moon, Sun, MoreHorizontal, ChevronDown } from 'lucide-react'
import { useNotices, useLinks, useAppInfo } from '../../hooks/useMore'
import { useShuttleSchedule } from '../../hooks/useShuttle'
import { useShuttleNotification } from '../../hooks/useShuttleNotification'
import useAppStore from '../../stores/useAppStore'
import { AboutModal } from '../map/InfoPanel'

function SectionLabel({ children }) {
  return (
    <p className="px-1 py-2 text-xs font-bold text-slate-400 tracking-widest uppercase">
      {children}
    </p>
  )
}

function Card({ children }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
      {children}
    </div>
  )
}

function Row({ icon, label, sub, right, onClick, href }) {
  const cls = 'block w-full text-left border-b border-slate-100 dark:border-slate-700 last:border-b-0 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50 active:bg-slate-100 first:rounded-t-2xl last:rounded-b-2xl overflow-hidden'
  const inner = (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <span className="w-7 flex items-center justify-center flex-shrink-0 text-slate-500 dark:text-slate-400">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{label}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
      {right}
    </div>
  )
  if (href) return <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>{inner}</a>
  if (onClick) return <button onClick={onClick} className={cls}>{inner}</button>
  return <div className={cls}>{inner}</div>
}

function NoticeRow({ notice }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="border-b border-slate-100 dark:border-slate-700 last:border-b-0 first:rounded-t-2xl last:rounded-b-2xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="block w-full text-left px-4 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 active:bg-slate-100 transition-colors"
      >
        <div className="flex items-start gap-3">
          <span className="w-7 flex items-center justify-center flex-shrink-0 text-slate-500 dark:text-slate-400 mt-0.5">
            <Megaphone size={18} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{notice.title}</p>
            <p className="text-xs text-slate-400 mt-0.5">{new Date(notice.created_at).toLocaleDateString('ko-KR')}</p>
          </div>
          <ChevronDown
            size={20}
            className={`text-slate-400 flex-shrink-0 mt-0.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          />
        </div>
      </button>
      {open && (
        <div className="px-4 pb-5 ml-10 text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
          {notice.content?.replace(/\\n/g, '\n')}
        </div>
      )}
    </div>
  )
}

function Toggle({ on }) {
  return (
    <div className={`w-10 h-6 rounded-full flex-shrink-0 transition-colors relative ${on ? 'bg-navy dark:bg-blue-600' : 'bg-slate-200 dark:bg-slate-600'}`}>
      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${on ? 'right-1' : 'left-1'}`} />
    </div>
  )
}

export default function MoreTab() {
  const { data: noticesData, loading: noticesLoading } = useNotices()
  const { data: linksData, loading: linksLoading } = useLinks()
  const { data: infoData } = useAppInfo()

  const { data: schedule } = useShuttleSchedule()
  const firstDirTimes = schedule?.directions?.[0]?.times ?? []
  const { enabled: notifEnabled, permission, toggle: toggleNotif } = useShuttleNotification(firstDirTimes)

  const darkMode = useAppStore((s) => s.darkMode)
  const toggleDarkMode = useAppStore((s) => s.toggleDarkMode)

  const notices = noticesData ?? []
  const links = linksData ?? []

  const [aboutOpen, setAboutOpen] = useState(false)

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900">
    <div className="flex items-center gap-2 bg-navy text-white px-5 py-4 flex-shrink-0">
      <MoreHorizontal size={20} strokeWidth={2} />
      <h2 className="text-lg font-bold">더보기</h2>
    </div>
    <div className="flex-1 overflow-y-auto px-4 py-4 pb-28 md:pb-6 gap-1 flex flex-col">

      <SectionLabel>공지사항</SectionLabel>
      <Card>
        {noticesLoading ? (
          <div className="py-6 text-center text-slate-400 text-sm">불러오는 중...</div>
        ) : notices.length === 0 ? (
          <div className="py-6 text-center text-slate-400 text-sm">언젠가 업데이트..</div>
        ) : (
          notices.map((n) => (
            <NoticeRow key={n.id} notice={n} />
          ))
        )}
      </Card>

      <SectionLabel>알림</SectionLabel>
      <Card>
        <div className="py-6 text-center text-slate-400 text-sm">언젠가 업데이트..</div>
      </Card>

      <SectionLabel>유용한 링크</SectionLabel>
      <Card>
        {linksLoading ? (
          <div className="py-6 text-center text-slate-400 text-sm">불러오는 중...</div>
        ) : links.length === 0 ? (
          <div className="py-6 text-center text-slate-400 text-sm">언젠가 업데이트..</div>
        ) : (
          links.map((lnk) => (
            <Row
              key={lnk.id}
              icon={lnk.icon}
              label={lnk.label}
              href={lnk.url}
              right={<span className="text-slate-300 dark:text-slate-500 ml-2 text-base">↗</span>}
            />
          ))
        )}
      </Card>

      <SectionLabel>앱 정보</SectionLabel>
      <Card>
        <Row
          icon={<Info size={18} />}
          label="탈정왕"
          sub={infoData ? `v${infoData.version} · ${infoData.description ?? '정왕 교통 허브'}` : '정왕 교통 허브'}
          onClick={() => setAboutOpen(true)}
        />
        {infoData?.feedback_url && (
          <Row
            icon={<MessageSquare size={18} />}
            label="피드백 보내기"
            href={infoData.feedback_url}
            right={<span className="text-slate-300 dark:text-slate-500 text-base">↗</span>}
          />
        )}
      </Card>

      <SectionLabel>디스플레이</SectionLabel>
      <Card>
        <Row
          icon={darkMode ? <Moon size={18} /> : <Sun size={18} />}
          label="다크모드"
          sub={darkMode ? '켜짐' : '꺼짐'}
          onClick={toggleDarkMode}
          right={<Toggle on={darkMode} />}
        />
      </Card>

      {aboutOpen && <AboutModal onClose={() => setAboutOpen(false)} />}
    </div>
    </div>
  )
}
