'use client';

import React, { useState, useEffect } from 'react';
import { AlertCircle, ChevronRight, RefreshCw } from 'lucide-react';
import {
  startOfMonth, endOfMonth, eachDayOfInterval, format, addMonths, subMonths,
  isSameDay, getDay, addDays, startOfWeek, endOfWeek
} from 'date-fns';
import { useScheduleStore } from '@/store/useScheduleStore';
import { paibanFetch } from '@/lib/paiban';

export default function LeaveRequestPage() {
  const {
    currentDate,
    currentUser,
    membersList,
    globalHolidayConfig,
    minStaffConfig,
    submittedLeaveData,
    setSubmittedLeaveData,
    prefillOpenMap,
    memberHolidayDays,
  } = useScheduleStore();

  const [fillMonth, setFillMonth] = useState(() => addMonths(new Date(2026, 2, 5), 1));
  const [leaveData, setLeaveData] = useState<Record<string, '轮休' | '请假'>>({});
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  // 其他成员当月意愿（用于显示日容量和他人选择）
  const [allLeaveData, setAllLeaveData] = useState<Record<string, { name: string; type: string }[]>>({});

  // fillMonth 变化时从后端拉取当前用户意愿和所有成员意愿
  useEffect(() => {
    const ym = format(fillMonth, 'yyyy-MM');
    // 拉当前用户已提交的意愿（覆盖本地草稿)
    paibanFetch(`/api/paiban/leave-wish/mine?month=${ym}`)
      .then(r => r.json())
      .then(res => {
        if (res.code === '0' && res.data) {
          setLeaveData(res.data as Record<string, '轮休' | '请假'>);
          setSubmittedLeaveData(prev => ({ ...prev, [ym]: res.data }));
        }
      })
      .catch(() => {});
    // 拉所有成员意愿（用于显示容量）
    paibanFetch(`/api/paiban/leave-wish/all?month=${ym}`)
      .then(r => r.json())
      .then(res => {
        if (res.code === '0' && res.data) {
          setAllLeaveData(res.data as Record<string, { name: string; type: string }[]>);
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fillMonth]);

  const getSubmittedOffDays = (name: string, monthYM?: string): number => {
    if (name === currentUser) {
      const all = monthYM
        ? (submittedLeaveData[monthYM] ?? {})
        : Object.values(submittedLeaveData).reduce((acc, m) => ({ ...acc, ...m }), {} as Record<string, string>);
      return Object.values(all).filter(v => v === '轮休').length;
    }
    const entries = monthYM
      ? Object.entries(allLeaveData).filter(([k]) => k.startsWith(monthYM + '-')).flatMap(([, v]) => v)
      : Object.values(allLeaveData).flat();
    return entries.filter(o => o.name === name && o.type === '轮休').length;
  };

  const getSubmittedLeaveDays = (name: string, monthYM?: string): number => {
    if (name === currentUser) {
      const all = monthYM
        ? (submittedLeaveData[monthYM] ?? {})
        : Object.values(submittedLeaveData).reduce((acc, m) => ({ ...acc, ...m }), {} as Record<string, string>);
      return Object.values(all).filter(v => v === '请假').length;
    }
    const entries = monthYM
      ? Object.entries(allLeaveData).filter(([k]) => k.startsWith(monthYM + '-')).flatMap(([, v]) => v)
      : Object.values(allLeaveData).flat();
    return entries.filter(o => o.name === name && o.type === '请假').length;
  };

  const hasSubmittedForMonth = (monthYM: string): boolean => {
    return !!submittedLeaveData[monthYM] && Object.keys(submittedLeaveData[monthYM]).length > 0;
  };

  const validateConsecutiveDays = () => {
    const nmStart = startOfMonth(fillMonth);
    const daysInMonth = parseInt(format(endOfMonth(nmStart), 'd'));
    let consecutiveWork = 0;
    for (let i = 1; i <= daysInMonth; i++) {
      const key = `${format(fillMonth, 'yyyy-MM')}-${i}`;
      const status = leaveData[key];
      if (!status) {
        consecutiveWork++;
      } else {
        consecutiveWork = 0;
      }
      if (consecutiveWork > 6) return false;
    }
    return true;
  };

  const handleSubmitWishes = async () => {
    if (!validateConsecutiveDays()) {
      setErrorMessage('当前存在连上大于 6 天的情况，请重新调整');
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }
    const fillMonthYM = format(fillMonth, 'yyyy-MM');
    const monthEntries: Record<string, '轮休' | '请假'> = {};
    Object.entries(leaveData).forEach(([k, v]) => {
      if (k.startsWith(fillMonthYM + '-')) monthEntries[k] = v;
    });
    // 持久化到后端
    await paibanFetch('/api/paiban/leave-wish', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month: fillMonthYM, wishes: monthEntries }),
    }).catch(() => {});
    setSubmittedLeaveData(prev => ({ ...prev, [fillMonthYM]: monthEntries }));
    setSuccessMessage(`${format(fillMonth, 'yyyy年MM月')} 意愿提交成功！`);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const toggleLeave = (day: number, type: '轮休' | '请假' | 'cancel') => {
    const key = `${format(fillMonth, 'yyyy-MM')}-${day}`;
    if (type === 'cancel') {
      const newData = { ...leaveData };
      delete newData[key];
      setLeaveData(newData);
    } else {
      setLeaveData({ ...leaveData, [key]: type });
    }
    setSelectedDay(null);
  };

  // Render
  const nmStart = startOfMonth(fillMonth);
  const nmEnd = endOfMonth(nmStart);
  const nmCalendarDays = eachDayOfInterval({
    start: startOfWeek(nmStart, { weekStartsOn: 1 }),
    end: endOfWeek(nmEnd, { weekStartsOn: 1 }),
  });

  const fillMonthYM = format(fillMonth, 'yyyy-MM');
  const usedOffDays = Object.entries(leaveData).filter(([k, v]) => k.startsWith(fillMonthYM + '-') && v === '轮休').length;
  const usedLeaveDays = Object.entries(leaveData).filter(([k, v]) => k.startsWith(fillMonthYM + '-') && v === '请假').length;

  const nmYear = parseInt(format(fillMonth, 'yyyy'));
  const nmMonth = parseInt(format(fillMonth, 'MM'));
  const nmPrefix = format(fillMonth, 'yyyy/MM');
  const nmMonthHolidays = globalHolidayConfig.filter(h => h.date.startsWith(nmPrefix));
  const publicHolidayNums = new Set(nmMonthHolidays.filter(h => h.type === '节假日').map(h => parseInt(h.date.split('/')[2])));
  const makeupWorkNums = new Set(nmMonthHolidays.filter(h => h.type === '调休上班日').map(h => parseInt(h.date.split('/')[2])));

  type DayType = '工作日' | '周末' | '节假日' | '调休日';
  const getDayType = (day: Date): DayType => {
    if (!(parseInt(format(day, 'MM')) === nmMonth && parseInt(format(day, 'yyyy')) === nmYear)) return '工作日';
    const d = parseInt(format(day, 'd'));
    if (publicHolidayNums.has(d)) return '节假日';
    if (makeupWorkNums.has(d)) return '调休日';
    const dow = getDay(day);
    if (dow === 0 || dow === 6) return '周末';
    return '工作日';
  };

  const nmAllDays = eachDayOfInterval({ start: nmStart, end: nmEnd });
  const nmLegalHolidayCount = nmMonthHolidays.filter(h => h.isLegal).length;
  const nmRegularWorkdays = nmAllDays.filter(d => getDayType(d) === '工作日').length;
  const nmLegalOvertimeCount = memberHolidayDays[currentUser] ?? nmLegalHolidayCount;
  const totalOffDays = nmAllDays.length - nmRegularWorkdays - makeupWorkNums.size - nmLegalOvertimeCount;

  const dayTypeToMinStaffKey: Record<DayType, string> = {
    '工作日': '普通工作日', '周末': '周末', '节假日': '法定节假日', '调休日': '调休工作日',
  };
  const getMaxRest = (dt: DayType): number =>
    Math.max(0, membersList.filter(m => m.inSchedule).length - (minStaffConfig[dayTypeToMinStaffKey[dt]] ?? 0));

  const getUsedRestCount = (dNum: number): number => {
    const key = `${format(fillMonth, 'yyyy-MM')}-${dNum}`;
    // allLeaveData 包含所有人（含自己），统一用它计算容量
    const totalInAll = (allLeaveData[key] || []).filter(o => o.type === '轮休').length;
    // 如果后端数据尚未加载（首次），用本地 leaveData 补充自己的选择
    const selfInAll = (allLeaveData[key] || []).some(o => o.name === currentUser);
    const selfCount = !selfInAll && leaveData[key] === '轮休' ? 1 : 0;
    return totalInAll + selfCount;
  };

  const dayTypeBg: Record<DayType, string> = {
    '工作日': '',
    '周末': 'bg-yellow-50',
    '节假日': 'bg-green-50',
    '调休日': 'bg-purple-50',
  };
  const dayTypeTag: Record<DayType, string> = {
    '工作日': '',
    '周末': 'text-yellow-600 bg-yellow-100 border-yellow-200',
    '节假日': 'text-green-700 bg-green-100 border-green-200',
    '调休日': 'text-purple-700 bg-purple-100 border-purple-200',
  };

  const fillPrevDay20 = addDays(startOfMonth(subMonths(fillMonth, 1)), 19);
  const isFillPrefillOpen = prefillOpenMap[fillMonthYM] !== undefined
    ? prefillOpenMap[fillMonthYM]
    : (currentDate.getTime() >= fillPrevDay20.getTime());
  const currentUserMember = membersList.find(m => m.name === currentUser);
  const isCurrentUserScheduled = !!(currentUserMember?.inSchedule);

  const fillMonthOptions = [1, 2, 3].map(n => addMonths(new Date(), n));

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 relative">
      {/* Toast 提醒 */}
      {errorMessage && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] bg-red-600 text-white px-8 py-4 rounded-2xl shadow-2xl font-black flex items-center gap-3 animate-in slide-in-from-top-4 border-2 border-white/20 backdrop-blur-md">
          <AlertCircle size={24} /> {errorMessage}
        </div>
      )}
      {successMessage && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] bg-green-500 text-white px-8 py-4 rounded-2xl shadow-2xl font-black flex items-center gap-3 animate-in slide-in-from-top-4 border-2 border-white/20 backdrop-blur-md">
          ✓ {successMessage}
        </div>
      )}

      {/* 顶部标题与操作栏 */}
      <div className="flex justify-between items-center bg-white p-6 rounded-[2rem] border shadow-sm">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
            <span className="bg-zinc-900 text-white p-2 rounded-2xl"><RefreshCw size={24} /></span>
            <select
              value={format(fillMonth, 'yyyy-MM')}
              onChange={e => {
                const newMonth = startOfMonth(new Date(e.target.value + '-01'));
                setFillMonth(newMonth);
                setSelectedDay(null);
                const ym = format(newMonth, 'yyyy-MM');
                setLeaveData(submittedLeaveData[ym] ?? {});
              }}
              className="select-inline text-2xl font-black text-gray-900 bg-transparent border-none outline-none cursor-pointer hover:text-zinc-700 transition-colors"
            >
              {fillMonthOptions.map(m => (
                <option key={format(m, 'yyyy-MM')} value={format(m, 'yyyy-MM')}>
                  {format(m, 'yyyy年 MM月')}
                </option>
              ))}
            </select>
            <span className="text-2xl font-black text-gray-900">· 休息意愿采集</span>
          </h1>
          <p className="text-sm text-gray-400 mt-1 font-medium flex items-center gap-2">
            请点击日期格子并预填轮休与请假意愿
            {hasSubmittedForMonth(fillMonthYM) && (
              <span className="text-[10px] font-black text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-lg">✓ 已提交</span>
            )}
            {!hasSubmittedForMonth(fillMonthYM) && Object.keys(leaveData).some(k => k.startsWith(fillMonthYM)) && (
              <span className="text-[10px] font-black text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg">● 草稿未提交</span>
            )}
          </p>
        </div>
        <div className="flex gap-4">
          <button
            onClick={handleSubmitWishes}
            className="px-8 py-3 bg-zinc-900 text-white rounded-2xl font-black hover:bg-black shadow-xl shadow-zinc-200 transition-all active:scale-95 flex items-center gap-2"
          >
            提交采集意愿 <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* 统计指标卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-3xl border shadow-sm group hover:border-zinc-200 transition-all">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">本月轮休总额度</span>
          <div className="flex items-end gap-2 mt-2">
            <span className="text-4xl font-black text-gray-900">{totalOffDays}</span>
            <span className="text-sm font-bold text-gray-400 mb-2">天</span>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border shadow-sm border-l-8 border-l-orange-500 group hover:border-orange-100 transition-all">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">本人已设轮休</span>
          <div className="flex items-end gap-2 mt-2">
            <span className="text-4xl font-black text-orange-600">{usedOffDays}</span>
            <span className="text-sm font-bold text-gray-400 mb-2">天</span>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border shadow-sm border-l-8 border-l-red-500 group hover:border-red-100 transition-all">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">本人额外请假</span>
          <div className="flex items-end gap-2 mt-2">
            <span className="text-4xl font-black text-red-600">{usedLeaveDays}</span>
            <span className="text-sm font-bold text-gray-400 mb-2">天</span>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border shadow-sm group hover:border-green-200 transition-all">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">剩余额度</span>
          <div className="flex items-end gap-2 mt-2">
            <span className={`text-4xl font-black ${totalOffDays - usedOffDays < 0 ? 'text-red-500' : 'text-green-600'}`}>
              {totalOffDays - usedOffDays}
            </span>
            <span className="text-sm font-bold text-gray-400 mb-2">天</span>
          </div>
        </div>
      </div>

      {/* 主日历容器 */}
      <div className="relative bg-white rounded-[2.5rem] border shadow-2xl overflow-hidden flex flex-col min-h-[850px]">
        {/* 未开放预填蒙版 */}
        {(!isFillPrefillOpen || !isCurrentUserScheduled) && (
          <div className="absolute inset-0 z-30 bg-white/70 backdrop-blur-md flex items-center justify-center rounded-[2.5rem]">
            <div className="text-center px-8 py-6 bg-white/80 rounded-3xl shadow-xl border border-gray-100">
              <div className="text-3xl mb-3">{isCurrentUserScheduled ? '🔒' : '🚫'}</div>
              <div className="text-base font-black text-gray-700">
                {isCurrentUserScheduled ? '该月份尚未开放填写，请耐心等待通知。' : '您不在排班成员中，无需填写。'}
              </div>
            </div>
          </div>
        )}
        {/* 日历表头 */}
        <div className="grid grid-cols-7 bg-zinc-900 border-b border-zinc-800">
          {['周一', '周二', '周三', '周四', '周五', '周六', '周日'].map(d => (
            <div key={d} className="py-5 text-center text-[11px] font-black text-zinc-500 uppercase tracking-[0.3em]">
              {d}
            </div>
          ))}
        </div>
        {/* 图例 */}
        <div className="flex items-center gap-6 px-6 py-3 border-b bg-gray-50/60 text-[11px] font-bold">
          <span className="text-gray-400 uppercase tracking-widest text-[10px]">图例</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-white border border-gray-200 inline-block"></span> 普通工作日</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-yellow-100 border border-yellow-200 inline-block"></span> 周末</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-100 border border-green-200 inline-block"></span> 节假日</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-purple-100 border border-purple-200 inline-block"></span> 调休日</span>
          <span className="ml-auto text-gray-400">「余 X/Y」= 该日剩余可休人数 / 上限</span>
        </div>

        <div className="flex-1 grid grid-cols-7 border-collapse">
          {nmCalendarDays.map((day, idx) => {
            const dNum = parseInt(format(day, 'd'));
            const isCurr = format(day, 'MM') === format(fillMonth, 'MM') && format(day, 'yyyy') === format(fillMonth, 'yyyy');
            const key = `${format(fillMonth, 'yyyy-MM')}-${dNum}`;
            const mySelection = isCurr ? leaveData[key] : null;
            // 显示其他人的选择（排除自己）
            const others = isCurr ? (allLeaveData[key] || []).filter(o => o.name !== currentUser) : [];
            const isSelected = selectedDay === dNum && isCurr;
            const dayType = isCurr ? getDayType(day) : '工作日';
            const maxRest = getMaxRest(dayType);
            const usedRest = isCurr ? getUsedRestCount(dNum) : 0;
            const restRemaining = maxRest - usedRest;

            return (
              <div
                key={idx}
                onClick={() => isCurr && setSelectedDay(isSelected ? null : dNum)}
                className={`relative min-h-[160px] border-r border-b border-gray-100 p-4 transition-all cursor-pointer flex flex-col group/cell ${
                  !isCurr ? 'bg-gray-50/50' : isSelected ? '' : dayTypeBg[dayType]
                } ${isSelected ? 'ring-4 ring-blue-500/20 ring-inset z-10 bg-blue-50/40' : ''}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex flex-col gap-1">
                    <span className={`text-lg font-black transition-colors ${!isCurr ? 'text-gray-200' : isSelected ? 'text-blue-600' : 'text-gray-900'}`}>
                      {format(day, 'd')}
                    </span>
                    {isCurr && dayType !== '工作日' && (() => {
                      const fillHolRow = nmMonthHolidays.find(r => parseInt(r.date.split('/')[2]) === dNum);
                      const fillHolLabel = fillHolRow
                        ? (fillHolRow.isLegal ? `${fillHolRow.name}·法定节假日` : fillHolRow.name)
                        : dayType;
                      return (
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md border self-start ${dayTypeTag[dayType]}`}>
                          {fillHolLabel}
                        </span>
                      );
                    })()}
                  </div>
                  {isCurr && (
                    <div className="flex flex-col items-end gap-1">
                      {isSameDay(day, new Date()) && (
                        <span className="bg-blue-600 text-white text-[9px] px-2 py-0.5 rounded-lg font-black tracking-widest">TODAY</span>
                      )}
                      <div className={`text-[9px] font-black px-2 py-0.5 rounded-lg border ${
                        restRemaining < 0
                          ? 'bg-red-100 text-red-700 border-red-300 animate-pulse'
                          : restRemaining === 0
                            ? 'bg-orange-100 text-orange-600 border-orange-300'
                            : restRemaining === 1
                              ? 'bg-yellow-50 text-yellow-600 border-yellow-200'
                              : 'bg-gray-50 text-gray-400 border-gray-100'
                      }`}>
                        {restRemaining < 0 ? `超 ${Math.abs(restRemaining)}` : restRemaining === 0 ? '已满' : `余 ${restRemaining}/${maxRest}`}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex-1 space-y-2.5 overflow-y-auto pr-1">
                  {mySelection && (
                    <div>
                      <div className={`px-3 py-2.5 rounded-2xl text-[11px] font-black border-2 transition-all shadow-sm ${
                        mySelection === '轮休'
                          ? 'bg-orange-600 text-white border-orange-500 shadow-orange-100'
                          : 'bg-red-600 text-white border-red-500 shadow-red-100'
                      }`}>
                        本人 · {mySelection}
                      </div>
                      {mySelection === '轮休' && restRemaining < 0 && (
                        <div className="mt-1 px-2 py-1 rounded-xl bg-red-100 border border-red-300 text-[9px] font-black text-red-700 leading-tight">
                          ⚠ 已超，排班时将随机去除人员
                        </div>
                      )}
                      {mySelection === '轮休' && restRemaining === 0 && (
                        <div className="mt-1 px-2 py-1 rounded-xl bg-orange-100 border border-orange-200 text-[9px] font-black text-orange-700">
                          已满
                        </div>
                      )}
                    </div>
                  )}

                  {others.map((o, i) => (
                    <div key={i} className={`px-3 py-2 rounded-xl text-[10px] font-bold border transition-all ${
                      o.type === '轮休'
                        ? 'bg-gray-50 text-gray-500 border-gray-100'
                        : 'bg-zinc-50 text-zinc-400 border-zinc-100'
                    }`}>
                      {o.name} · {o.type}
                    </div>
                  ))}
                </div>

                {isSelected && (
                  <div className="absolute inset-x-3 bottom-3 p-2 bg-white/95 backdrop-blur-xl border border-gray-200 shadow-2xl flex flex-col gap-1.5 rounded-[1.5rem] animate-in slide-in-from-bottom-4 duration-300 z-20 ring-1 ring-black/5">
                    <div className="flex gap-1.5">
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleLeave(dNum, '轮休'); }}
                        disabled={usedOffDays >= totalOffDays && mySelection !== '轮休'}
                        className={`flex-1 py-3 text-white text-[11px] font-black rounded-2xl shadow-lg active:scale-95 transition-all ${
                          usedOffDays >= totalOffDays && mySelection !== '轮休'
                            ? 'bg-gray-200 cursor-not-allowed text-gray-400'
                            : 'bg-orange-500 hover:bg-orange-600'
                        }`}
                      >
                        {usedOffDays >= totalOffDays && mySelection !== '轮休' ? '额度已满' : '填入轮休'}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleLeave(dNum, '请假'); }}
                        className="flex-1 py-3 bg-red-500 text-white text-[11px] font-black rounded-2xl shadow-lg hover:bg-red-600 active:scale-95 transition-all"
                      >
                        填入请假
                      </button>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleLeave(dNum, 'cancel'); }}
                      className="w-full py-2.5 bg-gray-100 text-gray-500 text-[10px] font-black rounded-xl hover:bg-gray-200 active:scale-95 transition-all"
                    >
                      取消选择
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
