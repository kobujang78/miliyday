"use client"
import React, { useEffect, useState } from 'react'

export default function NotificationToggle() {
  const [granted, setGranted] = useState<boolean>(false)
  const [enabled, setEnabled] = useState<boolean>(() => { try { return localStorage.getItem('mili_notify') === '1' } catch { return false } })

  useEffect(() => { setGranted(typeof Notification !== 'undefined' && Notification.permission === 'granted') }, [])

  async function request() {
    if (typeof Notification === 'undefined') return alert('브라우저가 알림을 지원하지 않습니다')
    const p = await Notification.requestPermission()
    setGranted(p === 'granted')
    if (p === 'granted') alert('알림 권한이 허용되었습니다')
    else alert('알림 권한이 거부되었습니다')
  }

  function toggle() {
    if (!granted) { request(); return }
    const newv = !enabled
    setEnabled(newv)
    try { localStorage.setItem('mili_notify', newv ? '1' : '0') } catch { }
    if (newv) {
      // demo: schedule a notification in 5 seconds to show flow
      setTimeout(() => {
        try { new Notification('슬기로운 병영생활', { body: '예시: 다음 마일스톤이 곧 도래합니다.' }) } catch { }
      }, 5000)
    }
  }

  return (
    <div className="mt-3 flex items-center gap-2">
      <button className="px-3 py-1 rounded bg-gray-100 text-sm" onClick={toggle}>{enabled ? '알림 끄기' : '알림 켜기'}</button>
      {!granted && <button className="px-3 py-1 rounded bg-white text-sm border" onClick={request}>권한 요청</button>}
    </div>
  )
}
