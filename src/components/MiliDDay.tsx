import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthProvider';

type Branch = 'army' | 'navy' | 'airforce' | 'marines' | 'katusa';

interface Props {
  enlistmentDate?: string; // YYYY-MM-DD (optional initially)
  branch?: Branch;
  className?: string;
}

const branchMap: Record<
  Branch,
  { months: number; label: string; color: string; accent: string }
> = {
  army: { months: 18, label: '육군', color: 'var(--accent-army)', accent: 'var(--accent-army)' },
  navy: { months: 20, label: '해군', color: 'var(--accent-navy)', accent: 'var(--accent-navy)' },
  airforce: { months: 21, label: '공군', color: 'var(--accent-airforce)', accent: 'var(--accent-airforce)' },
  marines: { months: 18, label: '해병대', color: 'var(--accent-marines)', accent: 'var(--accent-marines)' },
  katusa: { months: 18, label: '카투사', color: '#967117', accent: '#c2b280' },
};

function parseDateYMD(input: string): Date {
  const [y, m, d] = input.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
}

function daysBetween(a: Date, b: Date) {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((b.getTime() - a.getTime()) / msPerDay);
}

function formatDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

export default function MiliDDay({ enlistmentDate: propDate, branch: propBranch = 'army', className }: Props) {
  const { profile, connectedSoldier } = useAuth();

  // Determine if we should use local settings or connected soldier info
  const isSoldier = profile?.user_type === 'soldier';
  const hasConnection = !!profile?.connected_soldier_id && !!connectedSoldier;

  // Local state with localStorage persistence
  const [localBranch, setLocalBranch] = useState<Branch>(propBranch);
  const [localEnlistmentDate, setLocalEnlistmentDate] = useState<string | undefined>(propDate);

  // Effective values: use connected soldier info if available for non-soldiers
  const branch = (hasConnection && connectedSoldier?.branch) ? (connectedSoldier.branch as Branch) : localBranch;
  const enlistmentDate = (hasConnection && connectedSoldier?.enlist_date) ? connectedSoldier.enlist_date : localEnlistmentDate;

  useEffect(() => {
    // load saved
    try {
      const savedBranch = localStorage.getItem('mili_branch') as Branch | null;
      const savedDate = localStorage.getItem('mili_enlist');
      if (!propDate && savedDate) setLocalEnlistmentDate(savedDate);
      if (savedBranch) setLocalBranch(savedBranch);
    } catch (e) {
      // ignore
    }
  }, [propDate]);

  useEffect(() => {
    try {
      if (localEnlistmentDate) localStorage.setItem('mili_enlist', localEnlistmentDate);
      localStorage.setItem('mili_branch', localBranch);
    } catch (e) {}
  }, [localEnlistmentDate, localBranch]);

  const { totalDays, passedDays, remainingDays, percent, dischargeDate } = useMemo(() => {
    if (!enlistmentDate) return { totalDays: 0, passedDays: 0, remainingDays: 0, percent: 0, dischargeDate: new Date() };
    const months = branchMap[branch].months;
    const enlist = parseDateYMD(enlistmentDate);
    const end = new Date(enlist);
    end.setMonth(end.getMonth() + months);

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);

    const total = Math.max(1, daysBetween(enlist, end));
    const passed = Math.min(total, Math.max(0, daysBetween(enlist, today)));
    const remaining = Math.max(0, total - passed);
    const pct = Math.min(100, Math.max(0, (passed / total) * 100));

    return { totalDays: total, passedDays: passed, remainingDays: remaining, percent: Math.round(pct * 10) / 10, dischargeDate: end };
  }, [enlistmentDate, branch]);

  // Additional features:
  // 1) Next promotion estimate (simple heuristic: promotion roughly every 6 months)
  const nextPromotionDate = useMemo(() => {
    if (!enlistmentDate) return null;
    const enlist = parseDateYMD(enlistmentDate);
    // heuristic: promotions at 6, 12 months, etc. Find next multiple of 6 months after today
    const now = new Date();
    const monthsElapsed = (now.getFullYear() - enlist.getFullYear()) * 12 + (now.getMonth() - enlist.getMonth());
    const nextSlot = Math.ceil((monthsElapsed + 0.0001) / 6) * 6; // next multiple of 6
    const promo = new Date(enlist);
    promo.setMonth(promo.getMonth() + nextSlot);
    return promo;
  }, [enlistmentDate]);

  const daysToNextPromotion = nextPromotionDate ? daysBetween(new Date(), new Date(nextPromotionDate.getFullYear(), nextPromotionDate.getMonth(), nextPromotionDate.getDate())) : null;

  // 2) Upcoming leave example: assume 14-day leave at halfway point for demo (could be user-entered later)
  const leaveDate = useMemo(() => {
    if (!enlistmentDate) return null;
    const enlist = parseDateYMD(enlistmentDate);
    const months = branchMap[branch].months;
    const half = Math.floor(months / 2);
    const leave = new Date(enlist);
    leave.setMonth(leave.getMonth() + half);
    return leave;
  }, [enlistmentDate, branch]);

  const daysToLeave = leaveDate ? daysBetween(new Date(), new Date(leaveDate.getFullYear(), leaveDate.getMonth(), leaveDate.getDate())) : null;

  // Circular progress params
  const size = 140; // px
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - percent / 100);

  return (
    <div className={`w-full max-w-[480px] mx-auto bg-white rounded-xl p-4 shadow-sm ${className ?? ''}`} role="region" aria-label="복무기간 D-Day 계산기">
      <div className="flex items-start gap-4">
        <div style={{ width: size, height: size, minWidth: size, minHeight: size }} className="flex-none">
          <svg width="100%" height="100%" viewBox={`0 0 ${size} ${size}`} aria-hidden>
            <defs>
              <linearGradient id={`grad-${branch}`} x1="0%" x2="100%">
                <stop offset="0%" stopColor={branchMap[branch].accent} stopOpacity="1" />
                <stop offset="100%" stopColor={branchMap[branch].color} stopOpacity="0.9" />
              </linearGradient>
            </defs>
            <g transform={`translate(${size / 2}, ${size / 2})`}>
              <circle r={radius} fill="none" stroke="#f3f4f6" strokeWidth={stroke} strokeLinecap="round" />
              <circle r={radius} fill="none" stroke={`url(#grad-${branch})`} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${circumference} ${circumference}`} strokeDashoffset={offset} transform="rotate(-90)" style={{ transition: 'stroke-dashoffset 800ms cubic-bezier(.2,.9,.2,1)', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.06))' }} />
              <text x="0" y="-6" textAnchor="middle" fontSize="20" fontWeight={700} fill="#111827" className="font-sans">
                {percent.toFixed(1)}%
              </text>
              <text x="0" y="18" textAnchor="middle" fontSize="12" fill="#6b7280" className="font-sans">
                진행률
              </text>
            </g>
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-gray-900">{branchMap[branch].label} 복무</h3>
              {hasConnection && (
                <span className="bg-blue-100 text-blue-600 text-[10px] px-1.5 py-0.5 rounded font-bold">공유됨</span>
              )}
            </div>
            <select
              className="ml-3 rounded-md border px-2 py-1 text-sm disabled:opacity-50"
              value={branch}
              onChange={(e) => setLocalBranch(e.target.value as Branch)}
              disabled={hasConnection}
            >
              <option value="army">육군</option>
              <option value="navy">해군</option>
              <option value="airforce">공군</option>
              <option value="marines">해병대</option>
              <option value="katusa">카투사</option>
            </select>
          </div>

          <div className="mt-2">
            <label className="text-sm text-gray-600">입대일 {hasConnection && `(${connectedSoldier?.nickname || '용사'}님)`}</label>
            <div className="mt-1 flex gap-2">
              <input
                type="date"
                className="flex-1 rounded-md border px-3 py-2 text-sm disabled:bg-gray-50"
                value={enlistmentDate ?? ''}
                onChange={(e) => setLocalEnlistmentDate(e.target.value)}
                disabled={hasConnection}
              />
              {!hasConnection && (
                <button className="rounded-md bg-gray-100 px-3 py-2 text-sm" onClick={() => { setLocalEnlistmentDate(undefined); localStorage.removeItem('mili_enlist'); }}>지우기</button>
              )}
            </div>
          </div>

          {enlistmentDate ? (
            <>
              <p className="mt-3 text-sm text-gray-600">전역일: <span className="font-medium text-gray-800">{formatDate(dischargeDate)}</span></p>

              <div className="mt-3">
                <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                  <div className="h-3 rounded-full" style={{ width: `${percent}%`, background: `linear-gradient(90deg, ${branchMap[branch].accent}, ${branchMap[branch].color})`, transition: 'width 600ms ease' }} />
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-gray-600">
                  <div className="text-center">총: <div className="font-medium">{totalDays}일</div></div>
                  <div className="text-center">경과: <div className="font-medium">{passedDays}일</div></div>
                  <div className="text-center">남음: <div className="font-medium">{remainingDays}일</div></div>
                </div>
              </div>

              {/* Extra info: next promotion and leave */}
              <div className="mt-3 grid grid-cols-1 gap-2 text-sm">
                <div className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-md">
                  <div>
                    <div className="text-xs text-gray-500">다음 진급(예상)</div>
                    <div className="font-medium">{nextPromotionDate ? formatDate(nextPromotionDate) : '—'}</div>
                  </div>
                  <div className="text-sm text-gray-700">{daysToNextPromotion !== null ? (daysToNextPromotion > 0 ? `D-${daysToNextPromotion}` : '지남') : '—'}</div>
                </div>

                <div className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-md">
                  <div>
                    <div className="text-xs text-gray-500">예상 휴가(샘플)</div>
                    <div className="font-medium">{leaveDate ? formatDate(leaveDate) : '—'}</div>
                  </div>
                  <div className="text-sm text-gray-700">{daysToLeave !== null ? (daysToLeave > 0 ? `D-${daysToLeave}` : '지남') : '—'}</div>
                </div>
              </div>
            </>
          ) : (
            <p className="mt-3 text-sm text-gray-500">입대일을 입력하면 전역일, 진행률, D-Day 등을 계산합니다. 입력값은 기기 로컬에 저장됩니다.</p>
          )}
        </div>
      </div>
    </div>
  );
}
