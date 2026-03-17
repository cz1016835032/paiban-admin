'use client';

import React, { useEffect, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  Clock,
  Coffee,
  CalendarDays,
  Activity,
  ArrowLeftRight,
  X,
  Trash2,
  Check,
  CheckCircle2,
} from 'lucide-react';
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  addMonths,
  subMonths,
  isSameDay,
  getDay,
  addDays,
  startOfWeek,
  endOfWeek,
} from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { useScheduleStore } from '@/store/useScheduleStore';
import { paibanFetch } from '@/lib/paiban';
import type { SwapRequest, SwapPair, SavedSchedule, BoardEditLog } from '@/types/schedule';

const otherTeamsLeaveData: Record<string, { name: string; type: string }[]> = {};

export default function CalendarPage() {
  const {
    currentDate,
    setCurrentDate,
    currentUser,
    membersList,
    loading,
    dbBoardData,
    setDbBoardData,
    appliedSchedules,
    setAppliedSchedules,
    boardEditLogs,
    setBoardEditLogs,
    globalHolidayConfig,
    minStaffConfig,
    calcDayMinStaffOverrides,
    memberHolidayDays,
    swapRequests,
    setSwapRequests,
    setCalcDayMinStaffOverrides,
  } = useScheduleStore();

  // ── local state ────────────────────────────────────
  const [calendarViewMode, setCalendarViewMode] = useState<'current' | 'next'>('current');
  const [scheduleViewMode, setScheduleViewMode] = useState<'calendar' | 'table'>('calendar');
  const [onlyMe, setOnlyMe] = useState(false);

  const [boardEditMode, setBoardEditMode] = useState(false);
  const [boardEditDraft, setBoardEditDraft] = useState<Record<string, Record<number, '早' | '晚' | '休' | '假'>> | null>(null);
  const [boardEditDropdown, setBoardEditDropdown] = useState<{ name: string; day: number } | null>(null);
  const [boardEditConfirmSave, setBoardEditConfirmSave] = useState(false);
  const [boardLogOpen, setBoardLogOpen] = useState(true);

  const [showSwapModal, setShowSwapModal] = useState(false);
  const [swapTargetUser, setSwapTargetUser] = useState('');
  const [swapSelectedDays, setSwapSelectedDays] = useState<string[]>(['']);
  const [swapError, setSwapError] = useState<string | null>(null);
  const [swapValidationResult, setSwapValidationResult] = useState<string | null>(null);
  const [showSwapDetail, setShowSwapDetail] = useState<SwapRequest | null>(null);

  const [showScheduleConfirmModal, setShowScheduleConfirmModal] = useState(false);
  const [scheduleConfirmed, setScheduleConfirmed] = useState(false);
  const [scheduleConfirming, setScheduleConfirming] = useState(false);

  // ── computed ───────────────────────────────────────
  const nextMonthDate = addMonths(currentDate, 1);
  const calendarDisplayDate = calendarViewMode === 'next' ? nextMonthDate : currentDate;
  const boardMonthKey = format(calendarDisplayDate, 'yyyy-MM');
  const boardApplied = appliedSchedules[boardMonthKey] ?? null;
  // 优先用 boardApplied（内存 store），无则从服务端 dbBoardData 构造，用于对调弹窗
  const effectiveApplied: SavedSchedule | null = boardApplied ?? (
    dbBoardData && dbBoardData.length > 0
      ? {
          id: 'db',
          planName: 'DB',
          month: boardMonthKey,
          schedule: Object.fromEntries(
            dbBoardData.map(({ name, schedules }) => [
              name,
              Object.fromEntries(
                schedules.map(({ day, shift }) => [day, shift as '早' | '晚' | '休' | '假'])
              ),
            ])
          ),
        }
      : null
  );
  const isAdmin = membersList.find((m) => m.name === currentUser)?.role === '管理員' ||
    membersList.find((m) => m.name === currentUser)?.role === '管理员';

  const boardData: { name: string; schedules: { day: number; shift: string }[] }[] =
    dbBoardData && dbBoardData.length > 0
      ? dbBoardData
      : boardApplied
      ? Object.entries(boardApplied.schedule).map(([name, days]) => ({
          name,
          schedules: Object.entries(days).map(([d, s]) => ({ day: parseInt(d), shift: s })),
        }))
      : [];

  const currentUserHasSchedule =
    dbBoardData && dbBoardData.length > 0
      ? !!(dbBoardData.find((p) => p.name === currentUser)?.schedules.length)
      : !!(boardApplied?.schedule[currentUser] && Object.keys(boardApplied.schedule[currentUser]).length > 0);

  const calendarDays = eachDayOfInterval({
    start: startOfWeek(startOfMonth(calendarDisplayDate), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(startOfMonth(calendarDisplayDate)), { weekStartsOn: 1 }),
  });

  // ── effects ────────────────────────────────────────
  const loadSwapRequests = (month: string, user: string) => {
    const params = user ? `month=${month}&user=${encodeURIComponent(user)}` : `month=${month}`;
    paibanFetch(`/api/paiban/swap/list?${params}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.code === '0' && Array.isArray(res.data)) {
          const statusMap: Record<number, '待处理' | '已同意' | '已拒绝'> = { 0: '待处理', 1: '已同意', 2: '已拒绝' };
          const mapped: SwapRequest[] = (res.data as {
            id: number; fromUser: string; toUser: string; month: string;
            status: number; ctime: string;
            pairs: { fromDay: number; fromShift: string; toDay: number; toShift: string }[];
          }[]).map((item) => ({
            id: String(item.id),
            fromUser: item.fromUser,
            toUser: item.toUser,
            month: item.month,
            status: statusMap[item.status] ?? '待处理',
            createdAt: item.ctime,
            swaps: (item.pairs ?? []).map((p) => ({
              fromDay: p.fromDay,
              fromShift: p.fromShift as '早' | '晚' | '休' | '假',
              toDay: p.toDay,
              toShift: p.toShift as '早' | '晚' | '休' | '假',
            })),
          }));
          setSwapRequests(() => mapped);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    setBoardEditMode(false);
    setBoardEditDraft(null);
    setBoardEditDropdown(null);
    setDbBoardData(null);
    paibanFetch(`/api/paiban/schedule/detail?month=${boardMonthKey}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.code === '0' && Array.isArray(res.data) && res.data.length > 0) {
          const shiftMap: Record<string, '早' | '晚' | '休' | '假'> = {
            '1': '早', '早': '早',
            '2': '晚', '晚': '晚',
            '3': '休', '休': '休',
            '4': '假', '假': '假',
          };
          const grouped: Record<string, { day: number; shift: string }[]> = {};
          (res.data as { name: string; day: number; shift: string }[]).forEach((r) => {
            if (!grouped[r.name]) grouped[r.name] = [];
            const shift = shiftMap[r.shift] ?? r.shift;
            grouped[r.name].push({ day: r.day, shift });
          });
          setDbBoardData(
            Object.entries(grouped).map(([name, schedules]) => ({ name, schedules }))
          );
        }
      })
      .catch(() => {});
    if (currentUser) {
      loadSwapRequests(boardMonthKey, currentUser);
    }

    // 加载已应用排班方案信息
    paibanFetch(`/api/paiban/schedule/applied-plan/list?month=${boardMonthKey}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.code === '0' && Array.isArray(res.data) && res.data.length > 0) {
          const item = res.data[0] as { planId: string; planName: string; month: string; schedule: Record<string, Record<number, '早' | '晚' | '休' | '假'>> };
          setAppliedSchedules((prev) => ({ ...prev, [item.month]: { id: item.planId, planName: item.planName, month: item.month, schedule: item.schedule } }));
        }
      })
      .catch(() => {});

    // 加载当月看板编辑日志
    paibanFetch(`/api/paiban/board-log/list?month=${boardMonthKey}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.code === '0' && Array.isArray(res.data)) {
          setBoardEditLogs((_) => res.data as BoardEditLog[]);
        }
      })
      .catch(() => {});

    // 加载当月每日最低人数覆盖
    paibanFetch(`/api/paiban/min-staff-override/list?month=${boardMonthKey}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.code === '0' && res.data && typeof res.data === 'object') {
          const overrides = res.data as Record<string, number>;
          setCalcDayMinStaffOverrides((prev) => ({ ...prev, ...overrides }));
        }
      })
      .catch(() => {});

    // 加载当月排班确认状态
    if (currentUser) {
      setScheduleConfirmed(false);
      paibanFetch(`/api/paiban/schedule/confirm/status?month=${boardMonthKey}&user=${encodeURIComponent(currentUser)}`)
        .then((r) => r.json())
        .then((res) => {
          if (res.code === '0' && res.data) {
            setScheduleConfirmed(!!(res.data as { confirmed?: boolean }).confirmed);
          }
        })
        .catch(() => {});
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardMonthKey, currentUser]);

  // ── swap validation ────────────────────────────────
  const validateSwapResult = (
    schedule: Record<string, Record<number, '早' | '晚' | '休' | '假'>>,
    month: string
  ): string | null => {
    const mDate = new Date(month + '-01');
    const mStart = startOfMonth(mDate);
    const mEnd = endOfMonth(mStart);
    const mDays = eachDayOfInterval({ start: mStart, end: mEnd });
    const mHolPrefix = format(mDate, 'yyyy/MM');
    const mHols = globalHolidayConfig.filter((h) => h.date.startsWith(mHolPrefix));
    const mPubHols = new Set(
      mHols.filter((h) => h.type === '节假日').map((h) => h.date.replace(/\//g, '-'))
    );
    const mMakeup = new Set(
      mHols.filter((h) => h.type === '调休上班日').map((h) => h.date.replace(/\//g, '-'))
    );
    const getMDayTypeKey = (day: Date): string => {
      const ymd = format(day, 'yyyy-MM-dd');
      if (mPubHols.has(ymd)) return '法定节假日';
      if (mMakeup.has(ymd)) return '调休工作日';
      const dow = getDay(day);
      if (dow === 0 || dow === 6) return '周末';
      if (mPubHols.has(format(addDays(day, 1), 'yyyy-MM-dd'))) return '假前一日';
      return '普通工作日';
    };
    const mNormalWorkDayCount = mDays.filter((d) => {
      const t = getMDayTypeKey(d);
      return t === '普通工作日' || t === '假前一日' || t === '调休工作日';
    }).length;
    const mLegalHolidayCount = mHols.filter((h) => h.isLegal).length;
    const scheduledMembers = membersList.filter(
      (m) => schedule[m.name] && Object.keys(schedule[m.name]).length > 0
    );
    for (const m of scheduledMembers) {
      const legalWork = memberHolidayDays[m.name] ?? mLegalHolidayCount;
      const leaveCnt = mDays.filter(
        (d) => schedule[m.name]?.[parseInt(format(d, 'd'))] === '假'
      ).length;
      const requiredWorkDays = mNormalWorkDayCount + legalWork - leaveCnt;
      const actualWorkDays = mDays.filter((d) => {
        const s = schedule[m.name]?.[parseInt(format(d, 'd'))];
        return s === '早' || s === '晚';
      }).length;
      if (actualWorkDays !== requiredWorkDays)
        return `排班天数不符合：${m.name} 应排 ${requiredWorkDays} 天，实际 ${actualWorkDays} 天，请确认。`;
    }
    for (const m of scheduledMembers) {
      let consec = 0;
      for (const day of mDays) {
        const dn = parseInt(format(day, 'd'));
        const s = schedule[m.name]?.[dn];
        if (s === '早' || s === '晚') {
          consec++;
          if (consec > 6) return `存在连上>6天的情况（${m.name}），请调整。`;
        } else consec = 0;
      }
    }
    for (const m of scheduledMembers) {
      for (let i = 0; i < mDays.length - 1; i++) {
        const d1 = parseInt(format(mDays[i], 'd'));
        const d2 = parseInt(format(mDays[i + 1], 'd'));
        if (schedule[m.name]?.[d1] === '晚' && schedule[m.name]?.[d2] === '早')
          return `存在晚班转早班的情况（${m.name}），请调整。`;
      }
    }
    for (const day of mDays) {
      const dn = parseInt(format(day, 'd'));
      const ymd = format(day, 'yyyy-MM-dd');
      const ms =
        calcDayMinStaffOverrides[ymd] ?? (minStaffConfig[getMDayTypeKey(day)] ?? 1);
      let working = 0;
      scheduledMembers.forEach((m) => {
        const s = schedule[m.name]?.[dn];
        if (s === '早' || s === '晚') working++;
      });
      if (working < ms)
        return `存在排班人数不足的日期（${format(day, 'M/d')}），请调整。`;
    }
    return null;
  };

  const buildSwapPairs = (
    days: string[],
    applied: SavedSchedule | null,
    target: string
  ): SwapPair[] => {
    if (!applied || !target) return [];
    const pairs: SwapPair[] = [];
    for (const val of days) {
      if (!val) continue;
      const dayNum = parseInt(val);
      const myShift = applied.schedule[currentUser]?.[dayNum];
      const tarShift = applied.schedule[target]?.[dayNum];
      if (myShift && tarShift) {
        pairs.push({ fromDay: dayNum, fromShift: myShift, toDay: dayNum, toShift: tarShift });
      }
    }
    return pairs;
  };

  const runSwapValidation = (
    days: string[],
    applied: SavedSchedule | null,
    target: string
  ) => {
    if (!applied || !target || days.every((d) => !d)) {
      setSwapValidationResult(null);
      return;
    }
    const pairs = buildSwapPairs(days, applied, target);
    if (pairs.length === 0) {
      setSwapValidationResult(null);
      return;
    }
    const simSchedule: Record<string, Record<number, '早' | '晚' | '休' | '假'>> = {};
    for (const [k, v] of Object.entries(applied.schedule)) simSchedule[k] = { ...v };
    for (const p of pairs) {
      const curOld = simSchedule[currentUser][p.fromDay];
      const tarOld = simSchedule[target][p.toDay];
      simSchedule[currentUser][p.fromDay] = tarOld;
      simSchedule[target][p.toDay] = curOld;
    }
    const err = validateSwapResult(simSchedule, applied.month);
    setSwapValidationResult(err);
  };

  const handleSwapSubmit = () => {
    if (!effectiveApplied || !swapTargetUser) return;
    const pairs = buildSwapPairs(swapSelectedDays, effectiveApplied, swapTargetUser);
    if (pairs.length === 0) {
      setSwapError('请至少选择一个对调日期。');
      return;
    }
    const keys = pairs.map((p) => p.fromDay);
    if (new Set(keys).size !== keys.length) {
      setSwapError('存在重复的日期选择，请调整。');
      return;
    }
    const simSchedule: Record<string, Record<number, '早' | '晚' | '休' | '假'>> = {};
    for (const [k, v] of Object.entries(effectiveApplied.schedule)) simSchedule[k] = { ...v };
    for (const p of pairs) {
      const curOld = simSchedule[currentUser][p.fromDay];
      const tarOld = simSchedule[swapTargetUser][p.toDay];
      simSchedule[currentUser][p.fromDay] = tarOld;
      simSchedule[swapTargetUser][p.toDay] = curOld;
    }
    const err = validateSwapResult(simSchedule, effectiveApplied.month);
    if (err) {
      setSwapError(err);
      return;
    }
    paibanFetch('/api/paiban/swap/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromUser: currentUser,
        toUser: swapTargetUser,
        month: effectiveApplied.month,
        swaps: pairs,
      }),
    })
      .then((r) => r.json())
      .then((res) => {
        if (res.code === '0') {
          setShowSwapModal(false);
          setSwapError(null);
          setSwapValidationResult(null);
          loadSwapRequests(effectiveApplied.month, currentUser);
        } else {
          setSwapError(res.msg || '提交失败，请重试');
        }
      })
      .catch(() => setSwapError('网络错误，请重试'));
  };

  const handleSwapApprove = (req: SwapRequest) => {
    paibanFetch(`/api/paiban/swap/${req.id}/approve`, { method: 'POST' })
      .then((r) => r.json())
      .then((res) => {
        if (res.code === '0') {
          setShowSwapDetail(null);
          setSwapError(null);
          loadSwapRequests(req.month, currentUser);
        } else {
          setSwapError(res.msg || '操作失败，请重试');
        }
      })
      .catch(() => setSwapError('网络错误，请重试'));
  };

  const handleSwapReject = (req: SwapRequest) => {
    paibanFetch(`/api/paiban/swap/${req.id}/reject`, { method: 'POST' })
      .then((r) => r.json())
      .then((res) => {
        if (res.code === '0') {
          setShowSwapDetail(null);
          setSwapError(null);
          loadSwapRequests(req.month, currentUser);
        } else {
          setSwapError(res.msg || '操作失败，请重试');
        }
      })
      .catch(() => setSwapError('网络错误，请重试'));
  };

  // ── render helpers ─────────────────────────────────
  const renderCalendar = () => {
    const dispMonthPrefix = format(calendarDisplayDate, 'yyyy/MM');
    const dispMonthHolidayRows = globalHolidayConfig.filter((r) =>
      r.date.startsWith(dispMonthPrefix)
    );
    const dispPublicHolidayDays = new Set(
      dispMonthHolidayRows
        .filter((r) => r.type === '节假日')
        .map((r) => parseInt(r.date.split('/')[2]))
    );
    const dispMakeupWorkdays = new Set(
      dispMonthHolidayRows
        .filter((r) => r.type === '调休上班日')
        .map((r) => parseInt(r.date.split('/')[2]))
    );
    type DispDayType = '工作日' | '周末' | '节假日' | '调休日';
    const getDispDayType = (day: Date): DispDayType => {
      if (format(day, 'MM') !== format(calendarDisplayDate, 'MM')) return '工作日';
      const d = parseInt(format(day, 'd'));
      if (dispPublicHolidayDays.has(d)) return '节假日';
      if (dispMakeupWorkdays.has(d)) return '调休日';
      const dow = getDay(day);
      if (dow === 0 || dow === 6) return '周末';
      return '工作日';
    };
    const dispDayTypeBg: Record<DispDayType, string> = {
      工作日: '',
      周末: 'bg-yellow-50',
      节假日: 'bg-green-50',
      调休日: 'bg-purple-50',
    };
    const dispDayTypeTag: Record<DispDayType, string> = {
      工作日: '',
      周末: 'text-yellow-600 bg-yellow-100 border-yellow-200',
      节假日: 'text-green-700 bg-green-100 border-green-200',
      调休日: 'text-purple-700 bg-purple-100 border-purple-200',
    };

    return (
      <div className="bg-white rounded-[2.5rem] border shadow-2xl overflow-hidden flex flex-col min-h-[850px]">
        <div className="grid grid-cols-7 bg-zinc-900 border-b border-zinc-800">
          {['周一', '周二', '周三', '周四', '周五', '周六', '周日'].map((day) => (
            <div
              key={day}
              className="py-5 text-center text-[11px] font-black text-zinc-500 uppercase tracking-[0.3em]"
            >
              {day}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-6 px-6 py-3 border-b bg-gray-50/60 text-[11px] font-bold">
          <span className="text-gray-400 uppercase tracking-widest text-[10px]">图例</span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-white border border-gray-200 inline-block" /> 普通工作日
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-yellow-100 border border-yellow-200 inline-block" /> 周末
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-green-100 border border-green-200 inline-block" /> 节假日
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-purple-100 border border-purple-200 inline-block" /> 调休日
          </span>
          <span className="flex items-center gap-1.5 ml-auto">
            <span className="w-3 h-3 rounded bg-orange-100 border border-orange-200 inline-block" /> 我的休息日
          </span>
        </div>
        <div className="flex-1 grid grid-cols-7 border-collapse">
          {calendarDays.map((day, idx) => {
            const isCurrentMonth =
              format(day, 'MM') === format(calendarDisplayDate, 'MM');
            const isToday = isSameDay(day, new Date());
            const dayNum = parseInt(format(day, 'd'));
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            const isPast = isCurrentMonth && day < todayStart && !isToday;
            const dayType = getDispDayType(day);
            const mySched = isCurrentMonth
              ? boardData.find((p) => p.name === currentUser)?.schedules.find((s) => s.day === dayNum)
              : null;
            const isMyOff = mySched?.shift === '休' || mySched?.shift === '假';
            return (
              <div
                key={idx}
                className={`relative min-h-[160px] border-r border-b border-gray-100 p-4 transition-all flex flex-col group/cell ${
                  !isCurrentMonth
                    ? 'bg-gray-50/50'
                    : isPast
                    ? 'bg-gray-100'
                    : isMyOff
                    ? dispDayTypeBg[dayType] || 'bg-orange-50/30'
                    : dispDayTypeBg[dayType] || 'bg-white'
                }`}
              >
                <div className="flex justify-between items-center mb-2">
                  <span
                    className={`text-lg font-black transition-colors ${
                      isToday
                        ? 'text-blue-600'
                        : isPast
                        ? 'text-gray-400'
                        : isCurrentMonth
                        ? 'text-gray-900'
                        : 'text-gray-200'
                    }`}
                  >
                    {format(day, 'd')}
                  </span>
                  <div className="flex items-center gap-1 flex-wrap justify-end">
                    {isCurrentMonth &&
                      !isPast &&
                      dayType !== '工作日' &&
                      (() => {
                        const dispHolRow = globalHolidayConfig.find(
                          (r) => r.date === format(day, 'yyyy/MM/dd')
                        );
                        const dispHolLabel = dispHolRow
                          ? dispHolRow.isLegal
                            ? `${dispHolRow.name}·法定节假日`
                            : dispHolRow.name
                          : dayType;
                        return (
                          <span
                            className={`text-[9px] font-black px-1.5 py-0.5 rounded-md border ${dispDayTypeTag[dayType]}`}
                          >
                            {dispHolLabel}
                          </span>
                        );
                      })()}
                    {isToday && (
                      <span className="bg-blue-600 text-white text-[9px] px-2 py-0.5 rounded-lg font-black tracking-widest">
                        TODAY
                      </span>
                    )}
                    {isCurrentMonth && !isPast && mySched && !isMyOff && (
                      <div className="flex items-center gap-1 bg-white/80 backdrop-blur-sm px-1.5 py-0.5 rounded-full border border-zinc-200 shadow-sm">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            mySched.shift === '早' ? 'bg-blue-500' : 'bg-indigo-500'
                          }`}
                        />
                        <span className="text-[9px] font-black text-zinc-700">
                          我: {mySched.shift}
                        </span>
                      </div>
                    )}
                    {isCurrentMonth && !isPast && isMyOff && (
                      <div className="flex items-center bg-orange-100 px-1.5 py-0.5 rounded-full border border-orange-200">
                        <span className="text-[9px] font-black text-orange-700">
                          我: {mySched?.shift}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                {isCurrentMonth && (
                  <div
                    className={`flex-1 grid grid-cols-2 gap-1 overflow-hidden min-h-0 ${
                      isPast ? 'opacity-40' : ''
                    }`}
                  >
                    <div className="flex flex-col gap-0.5 border-r border-gray-100 pr-1 overflow-y-auto scrollbar-hide">
                      <div className="text-[9px] font-bold text-blue-500 mb-0.5 sticky top-0 bg-white/80 backdrop-blur-sm">
                        早
                      </div>
                      {(onlyMe ? boardData.filter((p) => p.name === currentUser) : boardData)
                        .map((p) => ({
                          name: p.name,
                          s: p.schedules.find((s) => s.day === dayNum),
                        }))
                        .filter((i) => i.s && i.s.shift === '早')
                        .map((i) => (
                          <div
                            key={i.name}
                            className={`text-[9px] px-1 py-0.5 rounded border truncate shadow-sm transition-all ${
                              i.name === currentUser
                                ? 'bg-blue-600 text-white border-blue-700 font-black scale-105 z-10'
                                : 'bg-blue-50 text-blue-700 border-blue-100'
                            }`}
                          >
                            {i.name}
                          </div>
                        ))}
                    </div>
                    <div className="flex flex-col gap-0.5 pl-1 overflow-y-auto scrollbar-hide">
                      <div className="text-[9px] font-bold text-indigo-500 mb-0.5 sticky top-0 bg-white/80 backdrop-blur-sm">
                        晚
                      </div>
                      {(onlyMe ? boardData.filter((p) => p.name === currentUser) : boardData)
                        .map((p) => ({
                          name: p.name,
                          s: p.schedules.find((s) => s.day === dayNum),
                        }))
                        .filter((i) => i.s && i.s.shift === '晚')
                        .map((i) => (
                          <div
                            key={i.name}
                            className={`text-[9px] px-1 py-0.5 rounded border truncate shadow-sm transition-all ${
                              i.name === currentUser
                                ? 'bg-indigo-600 text-white border-indigo-700 font-black scale-105 z-10'
                                : 'bg-indigo-50 text-indigo-700 border-indigo-100'
                            }`}
                          >
                            {i.name}
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderTableView = () => {
    const tableStart = startOfMonth(calendarDisplayDate);
    const tableEnd = endOfMonth(tableStart);
    const daysInMonth = eachDayOfInterval({ start: tableStart, end: tableEnd });
    const editing = boardEditMode && boardEditDraft !== null;
    const editDraft = boardEditDraft;
    const editDisplayData =
      editing && editDraft
        ? Object.entries(editDraft).map(([name, days]) => ({
            name,
            schedules: Object.entries(days).map(([d, s]) => ({
              day: parseInt(d),
              shift: s,
            })),
          }))
        : [];
    const displayData = editing
      ? onlyMe
        ? editDisplayData.filter((p) => p.name === currentUser)
        : editDisplayData
      : onlyMe
      ? boardData.filter((p) => p.name === currentUser)
      : boardData;
    const shiftStyle: Record<string, string> = {
      早: 'bg-blue-100 text-blue-700 border-blue-200',
      晚: 'bg-indigo-100 text-indigo-700 border-indigo-200',
      休: 'bg-orange-50 text-orange-500 border-orange-200',
      假: 'bg-gray-100 text-gray-400 border-gray-200',
    };
    const tblMonthPrefix = format(calendarDisplayDate, 'yyyy/MM');
    const tblHols = globalHolidayConfig.filter((h) => h.date.startsWith(tblMonthPrefix));
    const tblLegalHols = new Set(
      tblHols.filter((h) => h.isLegal).map((h) => {
        const parts = h.date.split('/');
        return parseInt(parts[2]);
      })
    );
    const tblLegalHolYmds = new Set(
      tblHols.filter((h) => h.isLegal).map((h) => {
        const parts = h.date.split('/');
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      })
    );
    const tblPubHolYmds = new Set(
      tblHols.filter((h) => h.type === '节假日').map((h) => {
        const parts = h.date.split('/');
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      })
    );
    const tblMakeupYmds = new Set(
      tblHols.filter((h) => h.type === '调休上班日').map((h) => {
        const parts = h.date.split('/');
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      })
    );
    const personStats = displayData.map((person) => {
      const counts = { 早: 0, 晚: 0, 休: 0, 假: 0, 法定: 0 };
      person.schedules.forEach((s) => {
        if (s.shift in counts) counts[s.shift as keyof typeof counts]++;
        if ((s.shift === '早' || s.shift === '晚') && tblLegalHols.has(s.day)) counts['法定']++;
      });
      return { name: person.name, counts };
    });
    const allData = editing ? editDisplayData : boardData;
    const dayStats = daysInMonth.map((day) => {
      const d = parseInt(format(day, 'd'));
      const counts = { 早: 0, 晚: 0, 休: 0, 假: 0 };
      allData.forEach((person) => {
        const shift = person.schedules.find((s) => s.day === d)?.shift;
        if (shift === '早') counts['早']++;
        else if (shift === '晚') counts['晚']++;
        else if (shift === '休') counts['休']++;
        else if (shift === '假') counts['假']++;
      });
      return counts;
    });
    const getBoardDayTypeKey = (day: Date): string => {
      const ymd = format(day, 'yyyy-MM-dd');
      if (tblPubHolYmds.has(ymd)) return '法定节假日';
      if (tblMakeupYmds.has(ymd)) return '调休工作日';
      const dow = getDay(day);
      if (dow === 0 || dow === 6) return '周末';
      if (tblPubHolYmds.has(format(addDays(day, 1), 'yyyy-MM-dd'))) return '假前一日';
      return '普通工作日';
    };
    let boardRule1Bad: string[] = [];
    let boardRule2Bad: string[] = [];
    let boardRule3BadDays: string[] = [];
    let boardRule4BadDays: string[] = [];
    let boardRule5Bad: { name: string; actual: number; required: number }[] = [];
    let boardHardFail = false;
    let boardSoftWarn = false;
    if (editing && editDraft) {
      const editMembers = editDisplayData;
      editMembers.forEach((m) => {
        let consec = 0;
        for (const day of daysInMonth) {
          const dn = parseInt(format(day, 'd'));
          const s = editDraft[m.name]?.[dn];
          if (s === '早' || s === '晚') {
            consec++;
            if (consec > 6) { boardRule1Bad.push(m.name); break; }
          } else consec = 0;
        }
      });
      editMembers.forEach((m) => {
        for (let i = 0; i < daysInMonth.length - 1; i++) {
          const d1 = parseInt(format(daysInMonth[i], 'd'));
          const d2 = parseInt(format(daysInMonth[i + 1], 'd'));
          if (editDraft[m.name]?.[d1] === '晚' && editDraft[m.name]?.[d2] === '早') {
            boardRule2Bad.push(m.name);
            break;
          }
        }
      });
      daysInMonth.forEach((day) => {
        const dn = parseInt(format(day, 'd'));
        let early = 0, late = 0;
        editMembers.forEach((m) => {
          const s = editDraft[m.name]?.[dn];
          if (s === '早') early++;
          if (s === '晚') late++;
        });
        const diff = late - early;
        if (diff !== 0 && diff !== 1) boardRule3BadDays.push(format(day, 'M/d'));
      });
      daysInMonth.forEach((day) => {
        const dn = parseInt(format(day, 'd'));
        const ymd = format(day, 'yyyy-MM-dd');
        const minStaff =
          calcDayMinStaffOverrides[ymd] ??
          (minStaffConfig[getBoardDayTypeKey(day)] ?? 1);
        let early = 0, late = 0;
        editMembers.forEach((m) => {
          const s = editDraft[m.name]?.[dn];
          if (s === '早') early++;
          if (s === '晚') late++;
        });
        if (early + late < minStaff) boardRule4BadDays.push(format(day, 'M/d'));
      });
      const bNormalWorkDayCount = daysInMonth.filter((d) => {
        const t = getBoardDayTypeKey(d);
        return t === '普通工作日' || t === '假前一日' || t === '调休工作日';
      }).length;
      const bLegalHolidayCount = tblHols.filter((h) => h.isLegal).length;
      editMembers.forEach((m) => {
        const legalWork = memberHolidayDays[m.name] ?? bLegalHolidayCount;
        const leaveCnt = daysInMonth.filter(
          (d) => editDraft[m.name]?.[parseInt(format(d, 'd'))] === '假'
        ).length;
        const requiredWorkDays = bNormalWorkDayCount + legalWork - leaveCnt;
        const actualWorkDays = daysInMonth.filter((d) => {
          const s = editDraft[m.name]?.[parseInt(format(d, 'd'))];
          return s === '早' || s === '晚';
        }).length;
        if (actualWorkDays !== requiredWorkDays)
          boardRule5Bad.push({ name: m.name, actual: actualWorkDays, required: requiredWorkDays });
      });
      boardHardFail =
        boardRule1Bad.length > 0 || boardRule2Bad.length > 0 || boardRule5Bad.length > 0;
      boardSoftWarn = boardRule3BadDays.length > 0 || boardRule4BadDays.length > 0;
    }

    return (
      <div
        className="bg-white rounded-2xl shadow-sm border overflow-hidden"
        onClick={() => editing && setBoardEditDropdown(null)}
      >
        {editing && (
          <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 flex items-center gap-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.5">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            <span className="text-sm font-bold text-amber-700">编辑模式 · 点击单元格可修改排班</span>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="sticky left-0 z-20 bg-gray-50 border-r px-4 py-3 text-left font-semibold text-gray-500 min-w-[80px]">
                  成员
                </th>
                {daysInMonth.map((day) => {
                  const isToday = isSameDay(day, new Date());
                  const dow = getDay(day);
                  const isWeekend = dow === 0 || dow === 6;
                  const todayStart = new Date();
                  todayStart.setHours(0, 0, 0, 0);
                  const isPast = day < todayStart && !isToday;
                  return (
                    <th
                      key={format(day, 'd')}
                      className={`px-1 py-2 text-center font-semibold min-w-[36px] border-r ${
                        isToday
                          ? 'bg-blue-600 text-white'
                          : isPast
                          ? 'bg-gray-100 text-gray-400'
                          : isWeekend
                          ? 'text-yellow-600 bg-yellow-50'
                          : 'text-gray-500'
                      }`}
                    >
                      <div>{format(day, 'd')}</div>
                      <div className="text-[9px] font-normal opacity-70">
                        {format(day, 'EEE', { locale: zhCN })}
                      </div>
                    </th>
                  );
                })}
                <th className="sticky z-20 bg-gray-100 border-l px-2 py-3 text-center font-semibold text-blue-600 min-w-[48px]" style={{ right: '192px' }}>早</th>
                <th className="sticky z-20 bg-gray-100 border-l px-2 py-3 text-center font-semibold text-indigo-600 min-w-[48px]" style={{ right: '144px' }}>晚</th>
                <th className="sticky z-20 bg-gray-100 border-l px-2 py-3 text-center font-semibold text-orange-500 min-w-[48px]" style={{ right: '96px' }}>轮休</th>
                <th className="sticky z-20 bg-gray-100 border-l px-2 py-3 text-center font-semibold text-red-500 min-w-[48px]" style={{ right: '48px' }}>请假</th>
                <th className="sticky right-0 z-20 bg-gray-100 border-l px-2 py-3 text-center font-semibold text-green-600 min-w-[48px]">法定</th>
              </tr>
            </thead>
            <tbody>
              {displayData.map((person, rowIdx) => {
                const stat = personStats[rowIdx].counts;
                return (
                  <tr key={person.name} className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}>
                    <td
                      className={`sticky left-0 z-10 border-r border-b px-4 py-2 font-bold whitespace-nowrap ${
                        rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                      } ${person.name === currentUser ? 'text-blue-600' : 'text-gray-800'}`}
                    >
                      {person.name}
                      {person.name === currentUser && (
                        <span className="ml-1 text-[9px] text-blue-400">(我)</span>
                      )}
                    </td>
                    {daysInMonth.map((day) => {
                      const d = parseInt(format(day, 'd'));
                      const sched = person.schedules.find((s) => s.day === d);
                      const shift = sched?.shift ?? '';
                      const isToday = isSameDay(day, new Date());
                      const todayStart = new Date();
                      todayStart.setHours(0, 0, 0, 0);
                      const isPast = day < todayStart && !isToday;
                      const isDropOpen =
                        editing &&
                        boardEditDropdown?.name === person.name &&
                        boardEditDropdown?.day === d;
                      return (
                        <td
                          key={d}
                          className={`border-r border-b p-1 text-center relative ${
                            isPast ? 'bg-gray-100' : isToday ? 'bg-blue-50' : ''
                          }`}
                          onClick={(e) => {
                            if (editing) {
                              e.stopPropagation();
                              setBoardEditDropdown(
                                isDropOpen ? null : { name: person.name, day: d }
                              );
                            }
                          }}
                        >
                          <span
                            className={`inline-flex items-center justify-center w-7 h-7 rounded-lg border text-[11px] font-black ${
                              editing
                                ? isDropOpen
                                  ? 'ring-2 ring-blue-400 ring-offset-1 cursor-pointer'
                                  : 'hover:ring-2 hover:ring-gray-300 hover:ring-offset-1 cursor-pointer'
                                : ''
                            } ${
                              shift
                                ? isPast
                                  ? 'bg-gray-200 text-gray-400 border-gray-300'
                                  : person.name === currentUser && !editing
                                  ? shift === '早'
                                    ? 'bg-blue-600 text-white border-blue-700'
                                    : shift === '晚'
                                    ? 'bg-indigo-600 text-white border-indigo-700'
                                    : 'bg-orange-200 text-orange-700 border-orange-300'
                                  : shiftStyle[shift] ?? 'bg-gray-50 text-gray-400 border-gray-200'
                                : 'bg-gray-50 text-gray-300 border-dashed border-gray-200'
                            }`}
                          >
                            {shift || '·'}
                          </span>
                          {isDropOpen && (
                            <div
                              className="absolute z-[500] top-full left-1/2 -translate-x-1/2 mt-0.5 bg-white border border-gray-200 rounded-xl shadow-xl p-1 flex flex-col gap-0.5 min-w-[44px]"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {(['早', '晚', '休', '假'] as const).map((opt) => (
                                <button
                                  key={opt}
                                  onClick={() => {
                                    setBoardEditDraft((prev) => {
                                      if (!prev) return prev;
                                      return {
                                        ...prev,
                                        [person.name]: { ...prev[person.name], [d]: opt },
                                      };
                                    });
                                    setBoardEditDropdown(null);
                                  }}
                                  className={`text-[11px] font-black px-2 py-1 rounded-lg transition-colors ${
                                    shift === opt
                                      ? 'bg-blue-100 text-blue-700'
                                      : 'hover:bg-gray-100 text-gray-700'
                                  }`}
                                >
                                  {opt}
                                </button>
                              ))}
                            </div>
                          )}
                        </td>
                      );
                    })}
                    <td className={`sticky z-10 border-l border-b px-2 py-2 text-center font-black text-blue-700 ${rowIdx % 2 === 0 ? 'bg-blue-50/60' : 'bg-blue-50'}`} style={{ right: '192px' }}>
                      {stat['早']}<span className="text-[9px] font-normal text-gray-400 ml-0.5">天</span>
                    </td>
                    <td className={`sticky z-10 border-l border-b px-2 py-2 text-center font-black text-indigo-700 ${rowIdx % 2 === 0 ? 'bg-indigo-50/60' : 'bg-indigo-50'}`} style={{ right: '144px' }}>
                      {stat['晚']}<span className="text-[9px] font-normal text-gray-400 ml-0.5">天</span>
                    </td>
                    <td className={`sticky z-10 border-l border-b px-2 py-2 text-center font-black text-orange-600 ${rowIdx % 2 === 0 ? 'bg-orange-50/60' : 'bg-orange-50'}`} style={{ right: '96px' }}>
                      {stat['休']}<span className="text-[9px] font-normal text-gray-400 ml-0.5">天</span>
                    </td>
                    <td className={`sticky z-10 border-l border-b px-2 py-2 text-center font-black text-red-500 ${rowIdx % 2 === 0 ? 'bg-red-50/40' : 'bg-red-50/60'}`} style={{ right: '48px' }}>
                      {stat['假']}<span className="text-[9px] font-normal text-gray-400 ml-0.5">天</span>
                    </td>
                    <td className={`sticky right-0 z-10 border-l border-b px-2 py-2 text-center font-black text-green-600 ${rowIdx % 2 === 0 ? 'bg-green-50/40' : 'bg-green-50/60'}`}>
                      {stat['法定']}<span className="text-[9px] font-normal text-gray-400 ml-0.5">天</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              {([
                { key: '早', dayKey: '早' as const, label: '早班人数', labelCls: 'text-blue-600 bg-blue-50 border-blue-200', numCls: 'text-blue-700', colIdx: 0 },
                { key: '晚', dayKey: '晚' as const, label: '晚班人数', labelCls: 'text-indigo-600 bg-indigo-50 border-indigo-200', numCls: 'text-indigo-700', colIdx: 1 },
                { key: '轮休', dayKey: '休' as const, label: '轮休人数', labelCls: 'text-orange-500 bg-orange-50 border-orange-200', numCls: 'text-orange-600', colIdx: 2 },
                { key: '请假', dayKey: '假' as const, label: '请假人数', labelCls: 'text-red-500 bg-red-50 border-red-200', numCls: 'text-red-600', colIdx: 3 },
              ]).map(({ key, dayKey, label, labelCls, numCls, colIdx }, fi) => {
                const total = dayStats.reduce((s, ds) => s + ds[dayKey], 0);
                return (
                  <tr key={key} className={fi === 0 ? 'bg-gray-50 border-t-2 border-gray-200' : 'bg-gray-50'}>
                    <td className="sticky left-0 z-10 bg-gray-100 border-r border-b px-4 py-2 font-bold whitespace-nowrap">
                      <span className={`inline-block text-[10px] font-black border rounded px-2 py-0.5 ${labelCls}`}>{label}</span>
                    </td>
                    {dayStats.map((ds, di) => {
                      const count = ds[dayKey];
                      const isToday = isSameDay(daysInMonth[di], new Date());
                      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
                      const isPast = daysInMonth[di] < todayStart && !isToday;
                      return (
                        <td key={di} className={`border-r border-b p-1 text-center ${isPast ? 'bg-gray-100' : isToday ? 'bg-blue-50' : ''}`}>
                          <span className={`text-[11px] font-black ${isPast ? 'text-gray-400' : numCls}`}>{count > 0 ? count : <span className="text-gray-300">0</span>}</span>
                        </td>
                      );
                    })}
                    <td className={`sticky z-10 border-l border-b px-2 py-2 text-center ${colIdx === 0 ? 'bg-blue-50' : 'bg-gray-100'}`} style={{ right: '192px' }}>
                      {colIdx === 0 && <><span className={`text-[11px] font-black ${numCls}`}>{total}</span><div className="text-[9px] text-gray-400">合计</div></>}
                    </td>
                    <td className={`sticky z-10 border-l border-b px-2 py-2 text-center ${colIdx === 1 ? 'bg-indigo-50' : 'bg-gray-100'}`} style={{ right: '144px' }}>
                      {colIdx === 1 && <><span className={`text-[11px] font-black ${numCls}`}>{total}</span><div className="text-[9px] text-gray-400">合计</div></>}
                    </td>
                    <td className={`sticky z-10 border-l border-b px-2 py-2 text-center ${colIdx === 2 ? 'bg-orange-50' : 'bg-gray-100'}`} style={{ right: '96px' }}>
                      {colIdx === 2 && <><span className={`text-[11px] font-black ${numCls}`}>{total}</span><div className="text-[9px] text-gray-400">合计</div></>}
                    </td>
                    <td className={`sticky z-10 border-l border-b px-2 py-2 text-center ${colIdx === 3 ? 'bg-red-50' : 'bg-gray-100'}`} style={{ right: '48px' }}>
                      {colIdx === 3 && <><span className={`text-[11px] font-black ${numCls}`}>{total}</span><div className="text-[9px] text-gray-400">合计</div></>}
                    </td>
                    <td className="sticky right-0 z-10 border-l border-b px-2 py-2 text-center bg-gray-100" />
                  </tr>
                );
              })}
            </tfoot>
          </table>
        </div>
        {editing && (
          <div className="px-6 py-4 border-t bg-white flex items-start gap-4 flex-wrap">
            <div className="flex-1 flex flex-col gap-1 min-w-0 text-xs">
              {boardRule1Bad.map((name) => (
                <span key={name} className="text-red-600 font-bold">⚠ {name} 存在连续上班 &gt;6 天的情况</span>
              ))}
              {boardRule2Bad.map((name) => (
                <span key={name} className="text-red-600 font-bold">⚠ {name} 存在晚班接早班的情况</span>
              ))}
              {boardRule5Bad.map(({ name, actual, required }) => (
                <span key={name} className="text-red-600 font-bold">⚠ {name} 的排班天数不正确（实际 {actual} 天 / 应排班 {required} 天）</span>
              ))}
              {!boardHardFail && boardRule3BadDays.length > 0 && (
                <span className="text-yellow-600 font-bold">⚠ 早晚班人数可能不均衡，请确认（{boardRule3BadDays.join('、')}）</span>
              )}
              {!boardHardFail && boardRule4BadDays.length > 0 && (
                <span className="text-yellow-600 font-bold">⚠ 当前日期排班人数可能较少，请确认（{boardRule4BadDays.join('、')}）</span>
              )}
              {!boardHardFail && !boardSoftWarn && (
                <span className="text-green-600 font-bold">✓ 所有规则均满足</span>
              )}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={() => { setBoardEditMode(false); setBoardEditDraft(null); setBoardEditDropdown(null); }}
                className="px-5 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm font-bold hover:bg-gray-100 transition-all"
              >
                取消
              </button>
              <button
                disabled={boardHardFail}
                onClick={() => { if (!boardHardFail) setBoardEditConfirmSave(true); }}
                className={`px-5 py-2 rounded-xl text-sm font-black text-white transition-all ${
                  boardHardFail
                    ? 'bg-gray-300 cursor-not-allowed opacity-60'
                    : boardSoftWarn
                    ? 'bg-yellow-400 hover:bg-yellow-500'
                    : 'bg-green-500 hover:bg-green-600'
                }`}
              >
                保存更改
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── render ─────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* 我的排班统计面板 */}
      {(() => {
        const myData = boardData.find((p) => p.name === currentUser);
        const earlyCount = myData ? myData.schedules.filter((s) => s.shift === '早').length : 0;
        const lateCount = myData ? myData.schedules.filter((s) => s.shift === '晚').length : 0;
        const workCount = earlyCount + lateCount;
        const restCount = myData
          ? myData.schedules.filter((s) => s.shift === '休' || s.shift === '假').length
          : 0;
        return (
          <div className="bg-gradient-to-br from-zinc-900 to-black p-6 rounded-[2rem] shadow-2xl border border-white/10 relative overflow-hidden group">
            <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 rounded-3xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner">
                  <span className="text-4xl">{myData ? '👋' : '📭'}</span>
                </div>
                <div>
                  {myData ? (
                    <>
                      <h2 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                        {currentUser}，您的 {format(calendarDisplayDate, 'M', { locale: zhCN })} 月排班
                        {scheduleConfirmed ? (
                          <span className="text-[11px] bg-green-500/20 text-green-400 px-3 py-1.5 rounded-full border border-green-500/30 font-black cursor-default select-none">
                            排班已确认
                          </span>
                        ) : (
                          <button
                            onClick={() => setShowScheduleConfirmModal(true)}
                            className="text-[11px] bg-orange-500 hover:bg-orange-400 text-white px-3 py-1.5 rounded-full font-black transition-colors shadow-lg"
                          >
                            待确认排班
                          </button>
                        )}
                      </h2>
                      <p className="text-zinc-400 mt-2 font-medium flex items-center gap-2 text-sm italic">
                        <Coffee size={14} /> 本月共有 {workCount} 天班，{restCount} 天休息。合理安排休息，保持高效服务！
                      </p>
                    </>
                  ) : (
                    <>
                      <h2 className="text-3xl font-black text-white tracking-tight">
                        {currentUser}，您在 {format(calendarDisplayDate, 'M', { locale: zhCN })} 月没有排班安排。
                      </h2>
                      <p className="text-zinc-500 mt-2 font-medium text-sm italic">
                        本月暂无排班方案，请联系管理员或等待排班发布。
                      </p>
                    </>
                  )}
                </div>
              </div>
              <div className="flex gap-4">
                <div className="px-8 py-5 bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl hover:border-blue-500/50 transition-all">
                  <div className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-2">早班总计</div>
                  <div className="flex items-end gap-2">
                    <span className="text-4xl font-black text-white">{earlyCount}</span>
                    <span className="text-xs font-bold text-zinc-500 mb-1.5 font-mono">DAYS</span>
                  </div>
                </div>
                <div className="px-8 py-5 bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl hover:border-indigo-500/50 transition-all">
                  <div className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-2">晚班总计</div>
                  <div className="flex items-end gap-2">
                    <span className="text-4xl font-black text-white">{lateCount}</span>
                    <span className="text-xs font-bold text-zinc-500 mb-1.5 font-mono">DAYS</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 标题行 + 月份切换 + 操作按钮 */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">
            {format(calendarDisplayDate, 'yyyy年 MM月', { locale: zhCN })}
          </h1>
          <div className="flex gap-4 mt-2">
            <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
              <span className="w-2 h-2 rounded-full bg-blue-500" /> 早班: 09:00 - 17:00
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
              <span className="w-2 h-2 rounded-full bg-indigo-500" /> 晚班: 13:00 - 21:00
            </div>
          </div>
        </div>

        {/* 本月 / 下月 切换 */}
        <div className="flex gap-2 bg-gray-100 p-1 rounded-2xl">
          <button
            onClick={() => { setCurrentDate(new Date(2026, 2, 5)); setCalendarViewMode('current'); }}
            className={`px-6 py-2 rounded-xl text-sm font-black transition-all ${
              calendarViewMode === 'current'
                ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200'
                : 'text-gray-400 hover:text-gray-700'
            }`}
          >
            本月 · {format(new Date(2026, 2, 5), 'MM月', { locale: zhCN })}
          </button>
          <button
            onClick={() => { setCurrentDate(new Date(2026, 2, 5)); setCalendarViewMode('next'); }}
            className={`px-6 py-2 rounded-xl text-sm font-black transition-all ${
              calendarViewMode === 'next'
                ? 'bg-zinc-900 text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-700'
            }`}
          >
            下月 · {format(addMonths(new Date(2026, 2, 5), 1), 'MM月', { locale: zhCN })}
          </button>
        </div>

        <div className="flex items-center gap-3">
          {isAdmin && boardApplied && !boardEditMode && (
            <button
              onClick={() => {
                setScheduleViewMode('table');
                const copy: Record<string, Record<number, '早' | '晚' | '休' | '假'>> = {};
                for (const [k, v] of Object.entries(boardApplied.schedule)) copy[k] = { ...v };
                setBoardEditDraft(copy);
                setBoardEditDropdown(null);
                setBoardEditMode(true);
              }}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg transition-all active:scale-95"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              编辑排班
            </button>
          )}
          {boardEditMode && (
            <button
              onClick={() => { setBoardEditMode(false); setBoardEditDraft(null); setBoardEditDropdown(null); }}
              className="flex items-center gap-2 bg-gray-200 hover:bg-gray-300 text-gray-700 px-5 py-2.5 rounded-xl font-bold transition-all active:scale-95"
            >
              退出编辑
            </button>
          )}
          <label className="flex items-center gap-2 cursor-pointer select-none bg-white border border-gray-200 rounded-xl px-4 py-2.5 shadow-sm hover:bg-gray-50 transition-all">
            <input
              type="checkbox"
              checked={onlyMe}
              onChange={(e) => setOnlyMe(e.target.checked)}
              className="w-4 h-4 rounded accent-blue-600 cursor-pointer"
            />
            <span className="text-sm font-bold text-gray-700">仅看自己</span>
          </label>
          <div className="flex border rounded-xl bg-white shadow-sm">
            <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-2.5 hover:bg-gray-50 border-r transition-colors">
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={() => { setCurrentDate(new Date(2026, 2, 5)); setCalendarViewMode('current'); }}
              className="px-4 text-sm font-bold hover:bg-gray-50 transition-colors"
            >
              回到今天
            </button>
            <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-2.5 hover:bg-gray-50 border-l transition-colors">
              <ChevronRight size={20} />
            </button>
          </div>
          <button
            onClick={() => {
              if (!currentUserHasSchedule) return;
              setSwapTargetUser('');
              setSwapSelectedDays(['']);
              setSwapError(null);
              setSwapValidationResult(null);
              setShowSwapModal(true);
            }}
            disabled={!currentUserHasSchedule}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold active:scale-95 ${
              currentUserHasSchedule
                ? 'bg-zinc-900 text-white shadow-lg hover:bg-black'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            <ArrowLeftRight size={18} /> 发起对调
          </button>
          <button
            onClick={() =>
              setScheduleViewMode((m) => (m === 'calendar' ? 'table' : 'calendar'))
            }
            className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-5 py-2.5 rounded-xl font-bold shadow-sm hover:bg-gray-50 transition-all active:scale-95"
          >
            {scheduleViewMode === 'calendar' ? (
              <><Activity size={16} /> 表格模式</>
            ) : (
              <><CalendarDays size={16} /> 日历模式</>
            )}
          </button>
        </div>
      </div>

      {/* 待处理对调请求 */}
      {(() => {
        const pendingSwaps = swapRequests.filter(
          (r) =>
            r.status === '待处理' &&
            r.month === boardMonthKey &&
            (r.fromUser === currentUser || r.toUser === currentUser)
        );
        const recentSwaps = swapRequests
          .filter(
            (r) =>
              r.status !== '待处理' &&
              r.month === boardMonthKey &&
              (r.fromUser === currentUser || r.toUser === currentUser)
          )
          .slice(-3);
        if (pendingSwaps.length === 0 && recentSwaps.length === 0) return null;
        return (
          <div className="bg-white rounded-2xl border shadow-sm p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-gray-700">
              <ArrowLeftRight size={16} className="text-yellow-600" />
              对调申请
            </div>
            {pendingSwaps.map((req) => (
              <div
                key={req.id}
                className="flex items-center gap-4 bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3"
              >
                <div className="flex-1">
                  <div className="text-sm font-bold text-gray-900">
                    {req.fromUser} ↔ {req.toUser}
                    <span className="ml-2 text-xs font-bold text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-lg border border-yellow-200">
                      待处理
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {req.swaps.map((sw, i) => (
                      <span key={i}>
                        {i > 0 && '，'}
                        {req.fromUser}的{sw.fromDay}日{sw.fromShift} ↔ {req.toUser}的{sw.toDay}日{sw.toShift}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => { setSwapError(null); setShowSwapDetail(req); }}
                  className="text-xs font-bold text-blue-600 hover:text-blue-700 bg-white border border-blue-200 px-4 py-2 rounded-xl hover:bg-blue-50 transition-all"
                >
                  {req.toUser === currentUser ? '审批' : '查看'}
                </button>
              </div>
            ))}
            {recentSwaps.map((req) => (
              <div
                key={req.id}
                className={`flex items-center gap-4 rounded-xl px-4 py-3 border ${
                  req.status === '已同意'
                    ? 'bg-green-50 border-green-200'
                    : 'bg-red-50 border-red-200'
                }`}
              >
                <div className="flex-1">
                  <div className="text-sm font-bold text-gray-900">
                    {req.fromUser} ↔ {req.toUser}
                    <span
                      className={`ml-2 text-xs font-bold px-2 py-0.5 rounded-lg border ${
                        req.status === '已同意'
                          ? 'text-green-700 bg-green-100 border-green-200'
                          : 'text-red-700 bg-red-100 border-red-200'
                      }`}
                    >
                      {req.status}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {req.swaps.map((sw, i) => (
                      <span key={i}>
                        {i > 0 && '，'}
                        {req.fromUser}的{sw.fromDay}日{sw.fromShift} ↔ {req.toUser}的{sw.toDay}日{sw.toShift}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => { setSwapError(null); setShowSwapDetail(req); }}
                  className="text-xs font-bold text-gray-500 hover:text-gray-700 bg-white border border-gray-200 px-4 py-2 rounded-xl hover:bg-gray-50 transition-all"
                >
                  查看
                </button>
              </div>
            ))}
          </div>
        );
      })()}

      {/* 日历 / 表格 */}
      {loading ? (
        <div className="h-[600px] flex items-center justify-center">
          <Loader2 className="animate-spin text-blue-500" size={48} />
        </div>
      ) : scheduleViewMode === 'table' ? (
        renderTableView()
      ) : (
        renderCalendar()
      )}

      {/* 排班调整日志 */}
      {(() => {
        const monthLogs = boardEditLogs.filter((l) => l.month === boardMonthKey);
        const shiftColor: Record<string, string> = {
          早: 'bg-blue-100 text-blue-700 border-blue-200',
          晚: 'bg-indigo-100 text-indigo-700 border-indigo-200',
          休: 'bg-orange-50 text-orange-500 border-orange-200',
          假: 'bg-gray-100 text-gray-400 border-gray-200',
          '': 'bg-gray-100 text-gray-400 border-dashed border-gray-300',
        };
        return (
          <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
            <button
              onClick={() => setBoardLogOpen((o) => !o)}
              className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors text-left"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-violet-500 shrink-0">
                <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
                <rect x="9" y="3" width="6" height="4" rx="1" />
                <path d="M9 12h6M9 16h4" />
              </svg>
              <span className="text-sm font-bold text-gray-800">排班调整记录</span>
              {monthLogs.length > 0 && (
                <span className="ml-1 text-[11px] font-black bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">
                  {monthLogs.length} 条
                </span>
              )}
              <span className="ml-auto text-xs text-gray-400 font-medium">{boardMonthKey}</span>
              <svg
                width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                className={`text-gray-400 transition-transform shrink-0 ${boardLogOpen ? 'rotate-180' : ''}`}
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
            {boardLogOpen && (
              <div className="border-t">
                {monthLogs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-2 text-gray-400">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
                      <rect x="9" y="3" width="6" height="4" rx="1" />
                      <path d="M9 12h6M9 16h4" />
                    </svg>
                    <span className="text-sm font-medium">本月暂无排班调整记录</span>
                  </div>
                ) : (
                  <div className="divide-y">
                    {monthLogs.map((log) => {
                      const dt = new Date(log.timestamp);
                      const timeStr = `${dt.getMonth() + 1}/${dt.getDate()} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
                      const logMeta: Record<string, { icon: React.ReactNode; badge: React.ReactNode; detail: React.ReactNode }> = {
                        edit: {
                          icon: (
                            <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2.5">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </div>
                          ),
                          badge: <span className="text-xs text-gray-400">手动修改了 <span className="font-black text-gray-700">{log.changes?.length ?? 0}</span> 个排班格</span>,
                          detail: (() => {
                            const byMember: Record<string, NonNullable<typeof log.changes>> = {};
                            (log.changes ?? []).forEach((c) => { (byMember[c.name] ??= []).push(c); });
                            return (
                              <div className="flex flex-col gap-1.5 pl-10 mt-2">
                                {Object.entries(byMember).map(([name, changes]) => (
                                  <div key={name} className="flex items-start gap-2 flex-wrap">
                                    <span className="text-xs font-bold text-gray-600 shrink-0 pt-0.5 min-w-[48px]">{name}</span>
                                    <div className="flex flex-wrap gap-1">
                                      {changes.sort((a, b) => a.day - b.day).map((c, i) => (
                                        <span key={i} className="inline-flex items-center gap-1 text-[11px] font-bold">
                                          <span className="text-gray-400">{c.day}日</span>
                                          <span className={`px-1.5 py-0.5 rounded border font-black ${c.fromShift ? shiftColor[c.fromShift] : 'border-dashed border-gray-300 text-gray-400'}`}>{c.fromShift || '—'}</span>
                                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                                          <span className={`px-1.5 py-0.5 rounded border font-black ${shiftColor[c.toShift] ?? shiftColor['']}`}>{c.toShift || '—'}</span>
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            );
                          })(),
                        },
                        apply_new: {
                          icon: <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center shrink-0"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg></div>,
                          badge: <span className="text-xs text-gray-400">首次应用方案 <span className="font-black text-gray-700">「{log.planName}」</span></span>,
                          detail: null,
                        },
                        apply_overwrite: {
                          icon: <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center shrink-0"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg></div>,
                          badge: <span className="text-xs text-gray-400">覆盖更新，重新应用方案 <span className="font-black text-gray-700">「{log.planName}」</span></span>,
                          detail: null,
                        },
                        swap_request: {
                          icon: <div className="w-7 h-7 rounded-full bg-yellow-100 flex items-center justify-center shrink-0"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ca8a04" strokeWidth="2.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /></svg></div>,
                          badge: <span className="text-xs text-gray-400">向 <span className="font-black text-gray-700">{log.swapTo}</span> 发起了对调申请，共 <span className="font-black text-gray-700">{log.swapPairs?.length ?? 0}</span> 个班次</span>,
                          detail: log.swapPairs && log.swapPairs.length > 0 ? (
                            <div className="pl-10 mt-2 flex flex-wrap gap-1">
                              {log.swapPairs.map((p, i) => (
                                <span key={i} className="inline-flex items-center gap-1 text-[11px] font-bold bg-yellow-50 border border-yellow-200 rounded-lg px-2 py-0.5">
                                  <span className="text-yellow-700">{log.swapFrom}</span><span className="text-gray-400">{p.fromDay}日</span><span className={`px-1 rounded border ${shiftColor[p.fromShift]}`}>{p.fromShift}</span>
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5"><path d="M7 16V4m0 0L3 8m4-4 4 4M17 8v12m0 0 4-4m-4 4-4-4" /></svg>
                                  <span className="text-yellow-700">{log.swapTo}</span><span className="text-gray-400">{p.toDay}日</span><span className={`px-1 rounded border ${shiftColor[p.toShift]}`}>{p.toShift}</span>
                                </span>
                              ))}
                            </div>
                          ) : null,
                        },
                        swap_approve: {
                          icon: <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center shrink-0"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg></div>,
                          badge: <span className="text-xs text-gray-400">同意了 <span className="font-black text-gray-700">{log.swapFrom}</span> 的对调申请，排班已更新</span>,
                          detail: log.swapPairs && log.swapPairs.length > 0 ? (
                            <div className="pl-10 mt-2 flex flex-wrap gap-1">
                              {log.swapPairs.map((p, i) => (
                                <span key={i} className="inline-flex items-center gap-1 text-[11px] font-bold bg-green-50 border border-green-200 rounded-lg px-2 py-0.5">
                                  <span className="text-green-700">{log.swapFrom}</span><span className="text-gray-400">{p.fromDay}日</span><span className={`px-1 rounded border ${shiftColor[p.fromShift]}`}>{p.fromShift}</span>
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5"><path d="M7 16V4m0 0L3 8m4-4 4 4M17 8v12m0 0 4-4m-4 4-4-4" /></svg>
                                  <span className="text-green-700">{log.swapTo}</span><span className="text-gray-400">{p.toDay}日</span><span className={`px-1 rounded border ${shiftColor[p.toShift]}`}>{p.toShift}</span>
                                </span>
                              ))}
                            </div>
                          ) : null,
                        },
                        swap_reject: {
                          icon: <div className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center shrink-0"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg></div>,
                          badge: <span className="text-xs text-gray-400">拒绝了 <span className="font-black text-gray-700">{log.swapFrom}</span> 的对调申请</span>,
                          detail: null,
                        },
                      };
                      const meta = logMeta[log.type ?? 'edit'];
                      return (
                        <div key={log.id} className="px-5 py-4 hover:bg-gray-50/60 transition-colors">
                          <div className="flex items-center gap-3">
                            {meta?.icon}
                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-black text-gray-900">{log.editor}</span>
                              <span className="ml-2">{meta?.badge}</span>
                            </div>
                            <span className="ml-auto text-xs text-gray-400 font-medium shrink-0">{timeStr}</span>
                          </div>
                          {meta?.detail}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* ===== 排班看板编辑-二次确认弹窗 ===== */}
      {boardEditConfirmSave && (
        <div
          className="fixed inset-0 z-[600] bg-black/60 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setBoardEditConfirmSave(false); }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 flex flex-col gap-5">
            <div className="text-base font-black text-gray-900">确认保存排班修改？</div>
            <div className="text-sm text-gray-500 leading-relaxed">
              确认后将直接覆盖当前已应用的排班方案（{boardMonthKey}），此操作不可撤销。
            </div>
            <div className="flex gap-3 justify-end mt-2">
              <button
                onClick={() => setBoardEditConfirmSave(false)}
                className="px-5 py-2 rounded-xl border border-gray-200 text-gray-600 font-bold text-sm hover:bg-gray-100 transition-all"
              >
                取消
              </button>
              <button
                onClick={() => {
                  if (!boardEditDraft || !boardApplied) return;
                  const diffChanges: { name: string; day: number; fromShift: string; toShift: string }[] = [];
                  for (const [name, days] of Object.entries(boardEditDraft)) {
                    const origDays = boardApplied.schedule[name] ?? {};
                    for (const [dn, newShift] of Object.entries(days)) {
                      const fromShift = origDays[parseInt(dn)] ?? '';
                      if (fromShift !== newShift)
                        diffChanges.push({ name, day: parseInt(dn), fromShift, toShift: newShift });
                    }
                  }
                  if (diffChanges.length > 0) {
                    const newLog: BoardEditLog = {
                      id: Date.now().toString(),
                      month: boardMonthKey,
                      editor: currentUser,
                      timestamp: new Date().toISOString(),
                      type: 'edit' as const,
                      changes: diffChanges,
                    };
                    setBoardEditLogs((prev) => [newLog, ...prev]);
                    paibanFetch('/api/paiban/board-log/add', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(newLog),
                    }).catch(() => {});
                  }
                  const updatedSchedule = boardEditDraft;
                  setAppliedSchedules((prev) => ({
                    ...prev,
                    [boardMonthKey]: { ...boardApplied, schedule: updatedSchedule },
                  }));
                  // 同步到服务端，让其他用户实时看到更新后的排班
                  paibanFetch('/api/paiban/schedule/apply', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ month: boardMonthKey, schedule: updatedSchedule }),
                  })
                    .then((r) => r.json())
                    .then((res) => {
                      if (res.code === '0') {
                        // 成功后刷新 dbBoardData，确保所有用户看到最新排班
                        setDbBoardData(
                          Object.entries(updatedSchedule).map(([name, days]) => ({
                            name,
                            schedules: Object.entries(days).map(([d, s]) => ({ day: parseInt(d), shift: s })),
                          }))
                        );
                      }
                    })
                    .catch(() => {});
                  setBoardEditConfirmSave(false);
                  setBoardEditMode(false);
                  setBoardEditDraft(null);
                  setBoardEditDropdown(null);
                }}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-sm transition-all"
              >
                确认保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== 发起对调弹窗 ===== */}
      {showSwapModal && effectiveApplied && (() => {
        const swMonth = new Date(effectiveApplied.month + '-01');
        const swDays = eachDayOfInterval({ start: startOfMonth(swMonth), end: endOfMonth(swMonth) });
        const eligibleUsers = membersList.filter(
          (m) => m.name !== currentUser && m.inSchedule && effectiveApplied.schedule[m.name]
        );
        const mySchedule = effectiveApplied.schedule[currentUser] ?? {};
        const targetSchedule = swapTargetUser ? (effectiveApplied.schedule[swapTargetUser] ?? {}) : {};
        const swappableDayOptions = swapTargetUser
          ? swDays
              .map((d) => {
                const dn = parseInt(format(d, 'd'));
                const myShift = mySchedule[dn];
                const tarShift = targetSchedule[dn];
                if (!myShift || !tarShift || myShift === tarShift) return null;
                return {
                  value: String(dn),
                  label: `${dn}日 · 我 · ${myShift}班  ⟷  ${swapTargetUser} · ${tarShift}班`,
                  day: dn,
                  myShift,
                  tarShift,
                };
              })
              .filter(Boolean) as { value: string; label: string; day: number; myShift: string; tarShift: string }[]
          : [];
        const usedDays = new Set(swapSelectedDays.filter(Boolean));
        const canSubmit =
          swapTargetUser !== '' && swapSelectedDays.some((d) => d !== '') && !swapValidationResult;
        return (
          <div
            className="fixed inset-0 z-[500] bg-black/70 flex items-center justify-center p-4"
            onClick={(e) => { if (e.target === e.currentTarget) setShowSwapModal(false); }}
          >
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="bg-zinc-900 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ArrowLeftRight size={20} className="text-white" />
                  <h2 className="text-lg font-black text-white">发起对调</h2>
                  <span className="text-xs text-zinc-400 font-medium">{effectiveApplied.month}</span>
                </div>
                <button onClick={() => setShowSwapModal(false)} className="text-zinc-400 hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 space-y-5">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">对调对象</label>
                  <select
                    value={swapTargetUser}
                    onChange={(e) => {
                      setSwapTargetUser(e.target.value);
                      setSwapSelectedDays(['']);
                      setSwapError(null);
                      setSwapValidationResult(null);
                    }}
                    className="select-compact w-full"
                  >
                    <option value="">请选择对调成员</option>
                    {eligibleUsers.map((m) => (
                      <option key={m.name} value={m.name}>{m.name}</option>
                    ))}
                  </select>
                </div>
                {swapTargetUser && (
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">选择对调班次</label>
                    {swappableDayOptions.length === 0 ? (
                      <div className="text-sm text-gray-400 bg-gray-50 rounded-xl px-4 py-3 border border-dashed border-gray-200">
                        两人没有可对调的班次（所有日期班次相同）
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {swapSelectedDays.map((day, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <div className="flex-1">
                              <select
                                value={day}
                                onChange={(e) => {
                                  const newDays = [...swapSelectedDays];
                                  newDays[idx] = e.target.value;
                                  setSwapSelectedDays(newDays);
                                  setSwapError(null);
                                  runSwapValidation(newDays, effectiveApplied, swapTargetUser);
                                }}
                                className="select-compact w-full text-xs"
                              >
                                <option value="">选择对调班次</option>
                                {swappableDayOptions.map((o) => (
                                  <option
                                    key={o.value}
                                    value={o.value}
                                    disabled={usedDays.has(o.value) && day !== o.value}
                                  >
                                    {o.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            {swapSelectedDays.length > 1 && (
                              <button
                                onClick={() => {
                                  const newDays = swapSelectedDays.filter((_, i) => i !== idx);
                                  setSwapSelectedDays(newDays);
                                  setSwapError(null);
                                  runSwapValidation(newDays, effectiveApplied, swapTargetUser);
                                }}
                                className="text-red-400 hover:text-red-600 transition-colors"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {swappableDayOptions.length > 0 && (
                      <button
                        onClick={() => setSwapSelectedDays((prev) => [...prev, ''])}
                        className="mt-3 flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors"
                      >
                        <span className="text-lg leading-none">+</span> 添加一组对调
                      </button>
                    )}
                  </div>
                )}
                {swapValidationResult && (
                  <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                    <span>{swapValidationResult}</span>
                  </div>
                )}
                {swapTargetUser && swapSelectedDays.some((d) => d !== '') && !swapValidationResult && (
                  <div className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700">
                    <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                    <span>校验通过，可以提交对调申请。</span>
                  </div>
                )}
                {swapError && (
                  <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                    <span>{swapError}</span>
                  </div>
                )}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowSwapModal(false)}
                    className="flex-1 py-3 rounded-xl border border-gray-200 font-bold text-gray-700 hover:bg-gray-50 transition-all"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleSwapSubmit}
                    disabled={!canSubmit}
                    className={`flex-1 py-3 rounded-xl font-black transition-all ${
                      canSubmit
                        ? 'bg-zinc-900 text-white hover:bg-black'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    提交对调申请
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ===== 对调详情/审批弹窗 ===== */}
      {showSwapDetail && (() => {
        const req = showSwapDetail;
        const isTarget = req.toUser === currentUser;
        const isPending = req.status === '待处理';
        const statusStyle: Record<string, string> = {
          待处理: 'bg-yellow-100 text-yellow-700 border-yellow-200',
          已同意: 'bg-green-100 text-green-700 border-green-200',
          已拒绝: 'bg-red-100 text-red-700 border-red-200',
        };
        return (
          <div
            className="fixed inset-0 z-[500] bg-black/70 flex items-center justify-center p-4"
            onClick={(e) => { if (e.target === e.currentTarget) { setShowSwapDetail(null); setSwapError(null); } }}
          >
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="bg-zinc-900 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ArrowLeftRight size={20} className="text-white" />
                  <h2 className="text-lg font-black text-white">对调详情</h2>
                </div>
                <button onClick={() => { setShowSwapDetail(null); setSwapError(null); }} className="text-zinc-400 hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-500">
                    <span className="font-bold text-gray-900">{req.fromUser}</span> →{' '}
                    <span className="font-bold text-gray-900">{req.toUser}</span>
                  </div>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${statusStyle[req.status]}`}>
                    {req.status}
                  </span>
                </div>
                <div className="text-xs text-gray-400">
                  月份: {req.month} · 发起时间: {new Date(req.createdAt).toLocaleString('zh-CN')}
                </div>
                <div className="space-y-2">
                  {req.swaps.map((sw, i) => (
                    <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3 border">
                      <div className="flex-1 text-center">
                        <div className="text-[10px] text-gray-400 font-bold">{req.fromUser}</div>
                        <div className="text-sm font-black">{sw.fromDay}日 · {sw.fromShift}</div>
                      </div>
                      <ArrowLeftRight size={16} className="text-gray-400" />
                      <div className="flex-1 text-center">
                        <div className="text-[10px] text-gray-400 font-bold">{req.toUser}</div>
                        <div className="text-sm font-black">{sw.toDay}日 · {sw.toShift}</div>
                      </div>
                    </div>
                  ))}
                </div>
                {swapError && (
                  <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                    <span>{swapError}</span>
                  </div>
                )}
                {isPending && isTarget && (
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => handleSwapReject(req)}
                      className="flex-1 py-3 rounded-xl border border-red-200 font-bold text-red-600 hover:bg-red-50 transition-all"
                    >
                      拒绝
                    </button>
                    <button
                      onClick={() => handleSwapApprove(req)}
                      className="flex-1 py-3 rounded-xl bg-green-600 text-white font-black hover:bg-green-700 transition-all"
                    >
                      同意
                    </button>
                  </div>
                )}
                {isPending && !isTarget && (
                  <div className="text-center text-sm text-gray-400 py-2">
                    等待 {req.toUser} 审批中...
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* 排班确认弹窗 */}
      {showScheduleConfirmModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full mx-4 flex flex-col gap-6 animate-in fade-in zoom-in-95">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="w-14 h-14 rounded-2xl bg-orange-100 flex items-center justify-center">
                <CheckCircle2 size={28} className="text-orange-500" />
              </div>
              <h3 className="text-lg font-black text-gray-900">确认排班</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                排班情况确认无误后，我们将为您发起 OA 审批
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowScheduleConfirmModal(false)}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-bold text-sm hover:bg-gray-50 transition-all"
              >
                我再看看
              </button>
              <button
                disabled={scheduleConfirming}
                onClick={async () => {
                  setScheduleConfirming(true);
                  try {
                    const res = await paibanFetch('/api/paiban/schedule/confirm', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ month: boardMonthKey, user: currentUser }),
                    });
                    const data = await res.json();
                    if (data.code === '0') {
                      setScheduleConfirmed(true);
                      setShowScheduleConfirmModal(false);
                      // 刷新看板数据
                      paibanFetch(`/api/paiban/schedule/detail?month=${boardMonthKey}`)
                        .then((r) => r.json())
                        .then((res2) => {
                          if (res2.code === '0' && Array.isArray(res2.data) && res2.data.length > 0) {
                            const shiftMap: Record<string, '早' | '晚' | '休' | '假'> = {
                              '1': '早', '早': '早', '2': '晚', '晚': '晚',
                              '3': '休', '休': '休', '4': '假', '假': '假',
                            };
                            const grouped: Record<string, { day: number; shift: string }[]> = {};
                            (res2.data as { name: string; day: number; shift: string }[]).forEach((r) => {
                              if (!grouped[r.name]) grouped[r.name] = [];
                              const shift = shiftMap[r.shift] ?? r.shift;
                              grouped[r.name].push({ day: r.day, shift });
                            });
                            setDbBoardData(
                              Object.entries(grouped).map(([name, schedules]) => ({ name, schedules }))
                            );
                          }
                        })
                        .catch(() => {});
                    }
                  } catch (_) {
                    // ignore
                  } finally {
                    setScheduleConfirming(false);
                  }
                }}
                className="flex-1 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-black text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {scheduleConfirming ? '提交中...' : '我已确认'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
