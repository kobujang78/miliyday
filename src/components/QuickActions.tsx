"use client"
import React from 'react'

function fmtDateToICS(d:string){
  // YYYY-MM-DD -> YYYYMMDD
  return d.replace(/-/g,'')
}

function downloadICS(title:string, dateStr:string){
  const dtStart = fmtDateToICS(dateStr) + 'T090000Z';
  // set end as next day
  const endDate = new Date(dateStr+'T09:00:00Z');
  endDate.setDate(endDate.getDate()+1);
  const dtEnd = endDate.toISOString().slice(0,19).replace(/[-:]/g,'')+'Z';
  const uid = `${Date.now()}@miliconnect.local`;
  const ics = `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//MiliConnect//EN\nBEGIN:VEVENT\nUID:${uid}\nDTSTAMP:${dtStart}\nDTSTART:${dtStart}\nDTEND:${dtEnd}\nSUMMARY:${title}\nEND:VEVENT\nEND:VCALENDAR`;
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${title}.ics`; a.click();
  URL.revokeObjectURL(url);
}

function genInvite(){
  return 'MILI-'+Math.random().toString(36).slice(2,8).toUpperCase();
}

export default function QuickActions({ inviteCode, dischargeDate }:{ inviteCode?:string; dischargeDate?:string }){
  const code = inviteCode || genInvite();
  async function handleShare(){
    const text = `MiliConnect 초대: ${code}`;
    if((navigator as any).share){
      try{ await (navigator as any).share({ title:'MiliConnect', text }); return }
      catch(e){}
    }
    await navigator.clipboard?.writeText(text);
    alert('공유 텍스트가 클립보드에 복사되었습니다');
  }

  return (
    <div className="flex gap-2">
      <button className="px-3 py-1 rounded bg-gray-100 text-sm" onClick={async () => { await navigator.clipboard?.writeText(code); alert('초대코드 복사됨: '+code); }}>초대코드 복사</button>
      <button className="px-3 py-1 rounded bg-gray-100 text-sm" onClick={() => { const d = dischargeDate || new Date().toISOString().slice(0,10); downloadICS('전역일', d); }}>캘린더 추가</button>
      <button className="px-3 py-1 rounded bg-gray-100 text-sm" onClick={handleShare}>공유</button>
    </div>
  )
}
