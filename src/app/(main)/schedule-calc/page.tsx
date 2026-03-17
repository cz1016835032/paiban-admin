'use client';

import React, { useState, useEffect } from 'react';
import {
  CalendarDays, RefreshCw, Cpu, CheckCircle2, Clock,
  ChevronLeft, ChevronRight, Loader2,
  Calendar as CalendarIcon, Activity
} from 'lucide-react';
import {
  startOfMonth, endOfMonth, eachDayOfInterval, format, addMonths, subMonths,
  getDay, addDays, startOfWeek, endOfWeek
} from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import { useScheduleStore } from '@/store/useScheduleStore';
import { paibanFetch } from '@/lib/paiban';
import type { SavedSchedule, BoardEditLog } from '@/types/schedule';

export default function ScheduleCalcPage() {
  const router = useRouter();
  const {
    currentDate,
    currentUser,
    membersList,
    globalHolidayConfig,
    minStaffConfig,
    submittedLeaveData,
    savedSchedules, setSavedSchedules,
    appliedSchedules, setAppliedSchedules,
    setBoardEditLogs,
    calcDayMinStaffOverrides, setCalcDayMinStaffOverrides,
    memberHolidayDays, setMemberHolidayDays,
    prefillOpenMap, setPrefillOpenMap,
    setCurrentDate,
  } = useScheduleStore();

  const [calcMonth, setCalcMonth] = useState(() => startOfMonth(addMonths(new Date(2026, 2, 5), 1)));
  const [calcScheduleResult, setCalcScheduleResult] = useState<Record<string, Record<number, '早' | '晚' | '休' | '假'>> | null>(null);
  const [calcLogs, setCalcLogs] = useState<string[]>([]);
  const [showCalcModal, setShowCalcModal] = useState(false);
  const [calcRunning, setCalcRunning] = useState(false);
  const [calcLoading, setCalcLoading] = useState(false);
  const [calcDone, setCalcDone] = useState(false);
  const [editingCalcHoliday, setEditingCalcHoliday] = useState(false);
  const [editingCalcCalendar, setEditingCalcCalendar] = useState(false);
  const [calcDayTypeOverrides, setCalcDayTypeOverrides] = useState<Record<string, '工作日' | '周末' | '法定节假日' | '调休工作日'>>({});
  const [calcDayTypeOverridesDraft, setCalcDayTypeOverridesDraft] = useState<Record<string, '工作日' | '周末' | '法定节假日' | '调休工作日'>>({});
  const [calcDayMinStaffOverridesDraft, setCalcDayMinStaffOverridesDraft] = useState<Record<string, number>>({});
  const [viewingSchedule, setViewingSchedule] = useState<SavedSchedule | null>(null);
  const [viewingScheduleMode, setViewingScheduleMode] = useState<'calendar' | 'table'>('calendar');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [viewingDraft, setViewingDraft] = useState<Record<string, Record<number, '早' | '晚' | '休' | '假'>> | null>(null);
  const [viewingDropdown, setViewingDropdown] = useState<{ name: string; day: number } | null>(null);
  const [viewingConfirmSave, setViewingConfirmSave] = useState(false);
  const [showApplyOverwriteConfirm, setShowApplyOverwriteConfirm] = useState<SavedSchedule | null>(null);
  const [showApplySuccess, setShowApplySuccess] = useState<SavedSchedule | null>(null);
  const [showSaveNameModal, setShowSaveNameModal] = useState(false);
  const [savePlanName, setSavePlanName] = useState('');
  const [showInsufficientModal, setShowInsufficientModal] = useState(false);
  // 排班确认统计
  const [confirmStats, setConfirmStats] = useState<{ confirmed: number; total: number } | null>(null);
  // 所有成员当月意愿（从后端拉取）
  const [allLeaveData, setAllLeaveData] = useState<Record<string, { name: string; type: string }[]>>({});

  // 页面挂载时从 API 加载已保存排班方案
  useEffect(() => {
    paibanFetch('/api/paiban/saved-schedule/list')
      .then(r => r.json())
      .then(res => {
        if (res.code === '0' && Array.isArray(res.data)) {
          const plans: SavedSchedule[] = res.data.map((item: Record<string, unknown>) => ({
            id: item.planId as string,
            planName: item.planName as string,
            month: item.month as string,
            schedule: item.schedule as Record<string, Record<number, '早' | '晚' | '休' | '假'>>,
          }));
          setSavedSchedules(() => plans);
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // calcMonth 变化时拉取全员意愿和每日最低人数覆盖
  useEffect(() => {
    const ym = format(calcMonth, 'yyyy-MM');
    paibanFetch(`/api/paiban/leave-wish/all?month=${ym}`)
      .then(r => r.json())
      .then(res => {
        if (res.code === '0' && res.data) {
          setAllLeaveData(res.data as Record<string, { name: string; type: string }[]>);
        }
      })
      .catch(() => {});
    paibanFetch(`/api/paiban/min-staff-override/list?month=${ym}`)
      .then(r => r.json())
      .then(res => {
        if (res.code === '0' && res.data && typeof res.data === 'object') {
          const overrides = res.data as Record<string, number>;
          setCalcDayMinStaffOverrides((prev) => ({ ...prev, ...overrides }));
        }
      })
      .catch(() => {});
    // 加载确认排班统计
    paibanFetch(`/api/paiban/schedule/confirm/stats?month=${ym}`)
      .then(r => r.json())
      .then(res => {
        if (res.code === '0' && res.data) {
          const d = res.data as { confirmed: number; total: number };
          setConfirmStats(d);
        } else {
          setConfirmStats(null);
        }
      })
      .catch(() => { setConfirmStats(null); });
  }, [calcMonth]);

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

  const applyScheduleToServer = async (plan: SavedSchedule): Promise<boolean> => {
    try {
      const res = await paibanFetch('/api/paiban/schedule/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: plan.month, schedule: plan.schedule, planId: plan.id, planName: plan.planName }),
      });
      const data = await res.json();
      return data.code === '0';
    } catch (_) {
      return false;
    }
  };

  const persistBoardLog = (log: BoardEditLog) => {
    setBoardEditLogs(prev => [log, ...prev]);
    paibanFetch('/api/paiban/board-log/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(log),
    }).catch(() => {});
  };

  const handleApply = async (plan: SavedSchedule) => {
    if (appliedSchedules[plan.month]) {
      setShowApplyOverwriteConfirm(plan);
    } else {
      const ok = await applyScheduleToServer(plan);
      if (!ok) {
        alert('排班方案同步服务端失败，请检查网络或重新登录后再试。');
        return;
      }
      setAppliedSchedules(prev => ({ ...prev, [plan.month]: plan }));
      persistBoardLog({ id: Date.now().toString(), month: plan.month, editor: currentUser, timestamp: new Date().toISOString(), type: 'apply_new' as const, planName: plan.planName });
      setShowApplySuccess(plan);
    }
  };
  const doApply = async (plan: SavedSchedule) => {
    const ok = await applyScheduleToServer(plan);
    if (!ok) {
      alert('排班方案同步服务端失败，请检查网络或重新登录后再试。');
      setShowApplyOverwriteConfirm(null);
      return;
    }
    setAppliedSchedules(prev => ({ ...prev, [plan.month]: plan }));
    persistBoardLog({ id: Date.now().toString(), month: plan.month, editor: currentUser, timestamp: new Date().toISOString(), type: 'apply_overwrite' as const, planName: plan.planName });
    setShowApplyOverwriteConfirm(null);
    setShowApplySuccess(plan);
  };
  const navigateToBoardMonth = (plan: SavedSchedule) => {
    const [year, month] = plan.month.split('-').map(Number);
    setCurrentDate(new Date(year, month - 1, 1));
    setShowApplySuccess(null);
    router.push('/calendar');
  };

  // ========== 排班计算核心算法 ==========
  const performScheduleCalc = async (): Promise<Record<string, Record<number, '早' | '晚' | '休' | '假'>> | null> => {
    const logs: string[] = [];
    const pushLog = (msg: string) => { logs.push(msg); setCalcLogs([...logs]); };
    const scheduledMembers = membersList.filter(m => m.inSchedule);

    const monthStart2 = startOfMonth(calcMonth);
    const monthEnd2 = endOfMonth(calcMonth);
    const allDays2 = eachDayOfInterval({ start: monthStart2, end: monthEnd2 });
    const totalDays2 = allDays2.length;
    const monthLabel = format(calcMonth, 'yyyy年MM月');
    const calcMonthYM = format(calcMonth, 'yyyy-MM');

    const mCalcPfx2 = format(calcMonth, 'yyyy/MM');
    const calcHolConf = globalHolidayConfig
      .filter(h => h.date.startsWith(mCalcPfx2))
      .map(h => ({
        date: h.date.replace(/\//g, '-'),
        type: (h.type === '节假日' ? '法定节假日' : '调休工作日') as '法定节假日' | '调休工作日',
        isLegal: h.isLegal,
      }));

    const getBaseT = (date: Date): '工作日' | '周末' | '法定节假日' | '调休工作日' => {
      const ymd = format(date, 'yyyy-MM-dd');
      const ov = calcDayTypeOverrides[ymd];
      if (ov) return ov;
      const hol = calcHolConf.find(h => h.date === ymd);
      if (hol) return hol.type;
      const dow = getDay(date);
      return (dow === 0 || dow === 6) ? '周末' : '工作日';
    };
    const getFinalT = (date: Date): string => {
      const base = getBaseT(date);
      if (base === '工作日') {
        const nb = getBaseT(addDays(date, 1));
        if (nb === '周末' || nb === '法定节假日') return '假前一日';
      }
      return base;
    };
    const minStaffKey: Record<string, string> = {
      '工作日': '普通工作日', '假前一日': '假前一日', '周末': '周末',
      '法定节假日': '法定节假日', '调休工作日': '调休工作日',
    };
    const getMinS = (dt: string, day?: Date) => {
      if (day) {
        const ymd = format(day, 'yyyy-MM-dd');
        if (calcDayMinStaffOverrides[ymd] !== undefined) return calcDayMinStaffOverrides[ymd];
      }
      return minStaffConfig[minStaffKey[dt] ?? '普通工作日'] ?? 2;
    };

    // ——— 辅助：对数组做 Fisher-Yates 随机洗牌 ———
    const shuffle = <T,>(arr: T[]): T[] => {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    };

    const memberCount = scheduledMembers.length;

    // ① 计算全月日期类型；推导各人额度
    // 当月工作日天数 = 工作日 + 假前一日 + 调休工作日（即所有正常需要上班的日期类型）
    const legalHolidayCountGlobal = calcHolConf.filter(h => h.isLegal).length;
    const normalWorkDayCount = allDays2.filter(d => {
      const t = getFinalT(d);
      return t === '工作日' || t === '假前一日' || t === '调休工作日';
    }).length;

    // 每日最大可休人数（用于后续容量检查）
    const dayMaxRest: Record<number, number> = {};
    allDays2.forEach(day => {
      const d = parseInt(format(day, 'd'));
      const dt = getFinalT(day);
      dayMaxRest[d] = Math.max(0, memberCount - getMinS(dt, day));
    });

    // 当前每日已休人数追踪（动态维护）
    const dayRestCount: Record<number, number> = {};
    allDays2.forEach(day => { dayRestCount[parseInt(format(day, 'd'))] = 0; });

    pushLog(`📅 ${monthLabel} 排班计算启动，共 ${memberCount} 名成员，${totalDays2} 天`);
    pushLog(`📊 当月工作日：${normalWorkDayCount} 天（含假前一日、调休工作日）`);
    pushLog('');

    // ② 解析休息意愿（轮休 + 请假）—— 从已提交数据读取
    const restWish: Record<string, Set<number>> = {};
    const leaveWish: Record<string, Set<number>> = {};
    scheduledMembers.forEach(m => { restWish[m.name] = new Set(); leaveWish[m.name] = new Set(); });
    const submittedForCalcMonth = submittedLeaveData[calcMonthYM] ?? {};
    Object.entries(submittedForCalcMonth).forEach(([key, type]) => {
      if (!key.startsWith(calcMonthYM + '-')) return;
      const parts = key.split('-');
      const d = parseInt(parts[parts.length - 1]);
      if (type === '轮休') restWish[currentUser]?.add(d);
      else if (type === '请假') leaveWish[currentUser]?.add(d);
    });
    Object.entries(allLeaveData).forEach(([key, ents]) => {
      if (!key.startsWith(calcMonthYM + '-')) return;
      const parts = key.split('-');
      const d = parseInt(parts[parts.length - 1]);
      ents.forEach(e => {
        if (e.type === '轮休') restWish[e.name]?.add(d);
        else if (e.type === '请假') leaveWish[e.name]?.add(d);
      });
    });

    // ③ 计算每人严格休息额度
    // 应排班天数 = 当月工作日天数 + 法定加班日天数 - 请假天数
    // 当月休息天数 = 当月总天数 - 应排班天数
    // 严格休日数（休，不含假）= 当月休息天数 - 请假天数
    //                         = 总天数 - 工作日 - 法定加班日
    const memberQuota: Record<string, { legalWork: number; leaveCnt: number; requiredWorkDays: number; requiredRestDays: number; requiredOffDays: number }> = {};
    scheduledMembers.forEach(m => {
      const legalWork = memberHolidayDays[m.name] ?? legalHolidayCountGlobal;
      const leaveCnt = leaveWish[m.name]?.size ?? 0;
      const requiredWorkDays = normalWorkDayCount + legalWork - leaveCnt;
      const requiredRestDays = totalDays2 - requiredWorkDays;      // 含假
      const requiredOffDays = requiredRestDays - leaveCnt;          // 纯休（不含假）
      memberQuota[m.name] = { legalWork, leaveCnt, requiredWorkDays, requiredRestDays, requiredOffDays };
    });

    pushLog('👤 各成员应排班额度：');
    scheduledMembers.forEach(m => {
      const q = memberQuota[m.name];
      pushLog(`  ${m.name}：应排班 ${q.requiredWorkDays} 天 / 应休息 ${q.requiredRestDays} 天（含请假 ${q.leaveCnt} 天 + 轮休 ${q.requiredOffDays} 天）`);
    });
    pushLog('');

    // ④ 超额检查：当日可休人数 = 总人数 - 最低排班人数；超额则随机剔除轮休意愿
    // 注意：请假（leaveWish）人员不参与随机去除，只从轮休（restWish）人员中随机剔除
    pushLog('🔍 检查休息日超额情况...');
    let anyExcess = false;
    for (const day of allDays2) {
      const dn = parseInt(format(day, 'd'));
      const maxR = dayMaxRest[dn];
      const wLeave = scheduledMembers.filter(m => leaveWish[m.name]?.has(dn));
      const wRest = scheduledMembers.filter(m => restWish[m.name]?.has(dn));
      const total = wLeave.length + wRest.length;
      if (total > maxR) {
        anyExcess = true;
        const excess = total - maxR;
        // 仅从轮休人员（wRest）中随机去除，请假人员（wLeave）不受影响
        const removable = shuffle(wRest.map(m => m.name));
        removable.slice(0, Math.min(excess, removable.length)).forEach(name => {
          restWish[name].delete(dn);
          pushLog(`  ⚠️ ${format(day, 'M月d日')} 超出 ${excess} 人，随机去除客服 ${name} 的休息意愿`);
        });
      }
    }
    if (!anyExcess) pushLog('  ✅ 无超额，休息意愿全部保留');
    pushLog('');

    // ⑤ 初始化排班表：固定 假 日，然后按严格额度调配 休 日
    pushLog('📐 按严格额度调配每人休息日...');
    const sch: Record<string, Record<number, '早' | '晚' | '休' | '假'>> = {};
    scheduledMembers.forEach(m => {
      sch[m.name] = {};
      // 先标注请假日（假，固定）
      leaveWish[m.name]?.forEach(d => { sch[m.name][d] = '假'; dayRestCount[d]++; });
    });

    // ⑤-A 法定节假日排班分配：按每人设置的法定节假日排班天数，优先确定法定节假日工作/休息情况
    const legalHolDayNums = allDays2
      .filter(d => { const ymd = format(d, 'yyyy-MM-dd'); return calcHolConf.some(h => h.date === ymd && h.isLegal); })
      .map(d => parseInt(format(d, 'd')));
    pushLog(`🎌 法定节假日：${legalHolDayNums.length} 天（${legalHolDayNums.map(d => `${d}日`).join('、') || '无'}）`);
    pushLog('🎌 按配置分配法定节假日排班...');

    // legalForcedWork[name]：该成员法定节假日中必须上班的日期（不得分配休）
    const legalForcedWork: Record<string, Set<number>> = {};
    // legalPreassignedOff[name]：已预分配为休息的法定节假日天数（占用 requiredOffDays 配额）
    const legalPreassignedOff: Record<string, number> = {};

    scheduledMembers.forEach(m => {
      const q = memberQuota[m.name];
      legalForcedWork[m.name] = new Set();
      // 当月该成员不请假的法定节假日
      const availLegal = legalHolDayNums.filter(d => !leaveWish[m.name]?.has(d));
      const lw = Math.min(q.legalWork, availLegal.length); // 实际需上班的法定节假日天数
      const legalRestCount = availLegal.length - lw;        // 其余变为休息
      // 随机分配：前 legalRestCount 天休息，剩余强制上班
      const shuffledLegal = shuffle(availLegal);
      const legalRestDays = shuffledLegal.slice(0, legalRestCount);
      const legalWorkDaysArr = shuffledLegal.slice(legalRestCount);
      legalRestDays.forEach(d => { sch[m.name][d] = '休'; dayRestCount[d]++; });
      legalWorkDaysArr.forEach(d => legalForcedWork[m.name].add(d));
      legalPreassignedOff[m.name] = legalRestCount;
      pushLog(`  ${m.name}：法定节假日共 ${availLegal.length} 天 → 排班 ${lw} 天，休息 ${legalRestCount} 天`);
    });
    pushLog('');

    // 逐人分配轮休（休）：必须恰好等于 requiredOffDays（去掉已预分配的法定节假日休息）
    scheduledMembers.forEach(m => {
      const q = memberQuota[m.name];
      // 需要额外分配的普通休息天数（法定节假日休息已在上一步占用）
      const needed = q.requiredOffDays - legalPreassignedOff[m.name];

      // 候选休日 = 非假日、非法定节假日（已在上一步处理完毕）
      const nonLeaveDays = allDays2
        .map(d => parseInt(format(d, 'd')))
        .filter(d => !leaveWish[m.name]?.has(d) && !legalHolDayNums.includes(d));

      // 优先级1：员工期望轮休 且 当日仍有容量（排除法定节假日，已在上一步处理）
      const wishDays = [...restWish[m.name]].filter(d =>
        !leaveWish[m.name]?.has(d) && !legalHolDayNums.includes(d) && dayRestCount[d] < dayMaxRest[d]
      );

      // 先选意愿天（不超容量）
      const chosen: number[] = [];
      shuffle(wishDays).forEach(d => {
        if (chosen.length < needed && dayRestCount[d] < dayMaxRest[d]) {
          chosen.push(d);
        }
      });

      // 若意愿天不足，从剩余可用天中随机补充
      if (chosen.length < needed) {
        const remaining = shuffle(
          nonLeaveDays.filter(d => !chosen.includes(d) && !restWish[m.name]?.has(d))
        );
        for (const d of remaining) {
          if (chosen.length >= needed) break;
          if (dayRestCount[d] < dayMaxRest[d]) {
            chosen.push(d);
          }
        }
      }

      // 若仍不足（极端情况：容量不够），放宽容量限制补足
      if (chosen.length < needed) {
        const fallback = shuffle(nonLeaveDays.filter(d => !chosen.includes(d)));
        for (const d of fallback) {
          if (chosen.length >= needed) break;
          chosen.push(d);
          pushLog(`  ⚠️ ${m.name} 第 ${d} 日超出当日容量但仍需排休（无法满足最低人数约束）`);
        }
      }

      // 若意愿天过多（超出额度），截断
      if (wishDays.length > needed) {
        const ignored = wishDays.filter(d => !chosen.includes(d));
        if (ignored.length > 0) {
          pushLog(`  📝 ${m.name} 轮休意愿 ${wishDays.length} 天，额度为 ${needed} 天，忽略 ${ignored.length} 天意愿`);
        }
      }

      chosen.forEach(d => {
        sch[m.name][d] = '休';
        dayRestCount[d]++;
      });

      const offActual = chosen.length;
      if (offActual !== needed) {
        pushLog(`  ⚠️ ${m.name} 轮休实际 ${offActual} 天，目标 ${needed} 天（容量约束导致偏差）`);
      }
    });
    pushLog('  ✅ 休息日分配完毕');
    pushLog('');

    // ⑥ 连续上班 > 6 天强制插入休息（尝试与现有某天换休，保持总量不变）
    pushLog('🔍 检查连续上班天数限制（最多6天）...');
    let insertedAny = false;
    scheduledMembers.forEach(m => {
      let consec = 0;
      for (const day of allDays2) {
        const d = parseInt(format(day, 'd'));
        if (sch[m.name][d] === '休' || sch[m.name][d] === '假') {
          consec = 0;
        } else {
          consec++;
          if (consec > 6) {
            // 尝试找一个当前休息日（离得最远的）换成工作日，将本日标为休
            // 优先选非法定节假日的休息日（避免破坏法定节假日配额）
            const curRestDays = allDays2
              .map(d2 => parseInt(format(d2, 'd')))
              .filter(d2 => sch[m.name][d2] === '休' && d2 !== d);
            const nonLegalRestDays = curRestDays.filter(d2 => !legalHolDayNums.includes(d2));
            const candidateRestDays = nonLegalRestDays.length > 0 ? nonLegalRestDays : curRestDays;
            // 找距离本日最远的休息日（避免产生新的连续问题）
            const swapTarget = candidateRestDays.length > 0
              ? candidateRestDays.reduce((best, cand) => Math.abs(cand - d) > Math.abs(best - d) ? cand : best)
              : null;
            if (swapTarget !== null) {
              sch[m.name][swapTarget] = '早'; // 换原休息日为工作日（临时）
              dayRestCount[swapTarget] = Math.max(0, dayRestCount[swapTarget] - 1);
            }
            sch[m.name][d] = '休';
            dayRestCount[d]++;
            consec = 0;
            insertedAny = true;
            pushLog(`  📝 ${m.name} 在 ${format(day, 'M月d日')} 强制休息（连续上班超6天）${swapTarget ? `，将第 ${swapTarget} 日由休改为上班以保持总量` : ''}`);
          }
        }
      }
    });
    if (!insertedAny) pushLog('  ✅ 连续天数均在6天以内');
    pushLog('');

    // ⑦ 分配早/晚班：偶数人平分早晚，单数人晚班多一个；晚班后次日不得接早班
    pushLog('🔄 分配早/晚班（偶数人平分早晚，奇数人晚班多一个；晚班次日不得接早班）...');
    const prevShiftMap: Record<string, '早' | '晚' | null> = {};
    const earlyCntMap: Record<string, number> = {};
    const lateCntMap: Record<string, number> = {};
    scheduledMembers.forEach(m => { prevShiftMap[m.name] = null; earlyCntMap[m.name] = 0; lateCntMap[m.name] = 0; });

    for (const day of allDays2) {
      const d = parseInt(format(day, 'd'));
      const workers = scheduledMembers.filter(m => sch[m.name][d] !== '休' && sch[m.name][d] !== '假');
      const wn = workers.length;

      scheduledMembers.filter(m => sch[m.name][d] === '休' || sch[m.name][d] === '假').forEach(m => {
        prevShiftMap[m.name] = null;
      });

      if (wn === 0) continue;

      const lateTarget = Math.ceil(wn / 2);
      const earlyTarget = Math.floor(wn / 2);
      const forcedLate = workers.filter(m => prevShiftMap[m.name] === '晚');
      const flexible = workers.filter(m => prevShiftMap[m.name] !== '晚');
      const lateNeed = Math.max(0, lateTarget - forcedLate.length);
      const sortedFlex = [...flexible].sort((a, b) => lateCntMap[a.name] - lateCntMap[b.name]);
      const flexLate = sortedFlex.slice(0, lateNeed);
      const flexEarly = sortedFlex.slice(lateNeed);

      [...forcedLate, ...flexLate].forEach(m => {
        sch[m.name][d] = '晚';
        lateCntMap[m.name]++;
        prevShiftMap[m.name] = '晚';
      });
      flexEarly.forEach(m => {
        sch[m.name][d] = '早';
        earlyCntMap[m.name]++;
        prevShiftMap[m.name] = '早';
      });

      if (forcedLate.length > 0) {
        pushLog(`  ${format(day, 'M月d日')} 共${wn}人上班（早${earlyTarget}晚${lateTarget}），${forcedLate.map(m => m.name).join('、')} 因昨日晚班强制继续晚班`);
      }
    }
    pushLog('');

    // ⑧ 确保每日最低排班人数（不足时将休→早）
    pushLog('⚡ 校验每日最低排班人数...');
    let enforcedAny = false;
    for (const day of allDays2) {
      const d = parseInt(format(day, 'd'));
      const dt = getFinalT(day);
      const minS = getMinS(dt, day);
      const working = scheduledMembers.filter(m => sch[m.name][d] === '早' || sch[m.name][d] === '晚');
      if (working.length < minS) {
        enforcedAny = true;
        const resting = scheduledMembers.filter(m => sch[m.name][d] === '休');
        resting.slice(0, minS - working.length).forEach(m => {
          sch[m.name][d] = '早';
          dayRestCount[d] = Math.max(0, dayRestCount[d] - 1);
          pushLog(`  ⚡ ${format(day, 'M月d日')} 人手不足（需${minS}人），强制 ${m.name} 上早班（轮休总量可能微调）`);
        });
      }
    }
    if (!enforcedAny) pushLog('  ✅ 每日人数均满足最低要求');
    pushLog('');

    // ⑨ 验证并输出每人最终统计
    pushLog('📊 各成员排班结果验证：');
    let validationPassed = true;
    scheduledMembers.forEach(m => {
      const q = memberQuota[m.name];
      const earlyActual = allDays2.filter(day => sch[m.name][parseInt(format(day, 'd'))] === '早').length;
      const lateActual = allDays2.filter(day => sch[m.name][parseInt(format(day, 'd'))] === '晚').length;
      const workActual = earlyActual + lateActual;
      const offActual = allDays2.filter(day => sch[m.name][parseInt(format(day, 'd'))] === '休').length;
      const leaveActual = allDays2.filter(day => sch[m.name][parseInt(format(day, 'd'))] === '假').length;
      const legalWorkActual = allDays2.filter(day => {
        const d = parseInt(format(day, 'd'));
        return legalHolDayNums.includes(d) && (sch[m.name][d] === '早' || sch[m.name][d] === '晚');
      }).length;
      // 休息日满足率：预提交轮休/请假中实际被安排为休/假的匹配天数比例
      const wishedOff = restWish[m.name] ?? new Set<number>();
      const wishedLeave = leaveWish[m.name] ?? new Set<number>();
      const totalWished = wishedOff.size + wishedLeave.size;
      const matchedOff = allDays2.filter(day => {
        const d = parseInt(format(day, 'd'));
        return wishedOff.has(d) && sch[m.name][d] === '休';
      }).length;
      const matchedLeave = allDays2.filter(day => {
        const d = parseInt(format(day, 'd'));
        return wishedLeave.has(d) && sch[m.name][d] === '假';
      }).length;
      const satisfactionRate = totalWished > 0 ? ((matchedOff + matchedLeave) / totalWished * 100).toFixed(2) : '100.00';
      const workMark = workActual === q.requiredWorkDays ? '✅' : '⚠️';
      const offMark = offActual === q.requiredOffDays ? '✅' : '⚠️';
      const legalMark = legalWorkActual === q.legalWork ? '✅' : '⚠️';
      if (workActual !== q.requiredWorkDays || legalWorkActual !== q.legalWork) validationPassed = false;
      pushLog(`  ${m.name}：上班 ${workMark}${workActual}/${q.requiredWorkDays} （早${earlyActual}+晚${lateActual}） | 轮休 ${offMark}${offActual}/${q.requiredOffDays} | 请假 ${leaveActual} | 法定节假日排班 ${legalMark}${legalWorkActual}/${q.legalWork}，轮休满足率${satisfactionRate}%`);
    });
    pushLog('');

    if (!validationPassed) {
      pushLog('❌ 验证未通过：存在成员排班天数不符合目标，正在自动重试...');
      return null;
    }

    // ⑩ 逐日打印结果
    pushLog('📋 逐日排班明细：');
    pushLog('');
    for (const day of allDays2) {
      const d = parseInt(format(day, 'd'));
      const dt = getFinalT(day);
      const minS = getMinS(dt, day);
      const early = scheduledMembers.filter(m => sch[m.name][d] === '早').map(m => m.name);
      const late = scheduledMembers.filter(m => sch[m.name][d] === '晚').map(m => m.name);
      const rest = scheduledMembers.filter(m => sch[m.name][d] === '休' || sch[m.name][d] === '假').map(m => m.name);
      pushLog(`  ${format(day, 'M月d日')}（${dt}，最低${minS}人）早[${early.join(' ') || '无'}] 晚[${late.join(' ') || '无'}] 休/假[${rest.join(' ') || '无'}]`);
      await new Promise(r => setTimeout(r, 18));
    }
    pushLog('');
    pushLog('✅ 排班计算完成！');
    return sch;
  };

  const MAX_RETRY = 8;
  const runCalcWithRetry = async (): Promise<Record<string, Record<number, '早' | '晚' | '休' | '假'>> | null> => {
    for (let i = 1; i <= MAX_RETRY; i++) {
      const result = await performScheduleCalc();
      if (result !== null) return result;
      if (i < MAX_RETRY) await new Promise(r => setTimeout(r, 50));
    }
    setCalcLogs(prev => [...prev, '', `❌ 自动重试 ${MAX_RETRY} 次后仍无法生成满足条件的排班，请检查配置正确性或手动调整意愿。`]);
    return null;
  };

  const handleCalc = async () => {
    // ===== 校验：总可用班次 vs 总需求班次 =====
    const scheduledMembersCheck = membersList.filter(m => m.inSchedule);
    const calcMonthYMCheck = format(calcMonth, 'yyyy-MM');
    const monthStartCheck = startOfMonth(calcMonth);
    const monthEndCheck = endOfMonth(calcMonth);
    const allDaysCheck = eachDayOfInterval({ start: monthStartCheck, end: monthEndCheck });
    const mCalcPfxCheck = format(calcMonth, 'yyyy/MM');
    const calcHolConfCheck = globalHolidayConfig
      .filter(h => h.date.startsWith(mCalcPfxCheck))
      .map(h => ({
        date: h.date.replace(/\//g, '-'),
        type: (h.type === '节假日' ? '法定节假日' : '调休工作日') as '法定节假日' | '调休工作日',
        isLegal: h.isLegal,
      }));
    const legalHolidayCountCheck = calcHolConfCheck.filter(h => h.isLegal).length;
    const getBaseTCheck = (date: Date): '工作日' | '周末' | '法定节假日' | '调休工作日' => {
      const ymd = format(date, 'yyyy-MM-dd');
      const ov = calcDayTypeOverrides[ymd];
      if (ov) return ov;
      const hol = calcHolConfCheck.find(h => h.date === ymd);
      if (hol) return hol.type;
      const dow = getDay(date);
      return (dow === 0 || dow === 6) ? '周末' : '工作日';
    };
    const getFinalTCheck = (date: Date): string => {
      const base = getBaseTCheck(date);
      if (base === '工作日') {
        const nb = getBaseTCheck(addDays(date, 1));
        if (nb === '周末' || nb === '法定节假日') return '假前一日';
      }
      return base;
    };
    const minStaffKeyMapCheck: Record<string, string> = {
      '工作日': '普通工作日', '假前一日': '假前一日', '周末': '周末',
      '法定节假日': '法定节假日', '调休工作日': '调休工作日',
    };
    const getMinSCheck = (dt: string, day?: Date) => {
      if (day) {
        const ymd = format(day, 'yyyy-MM-dd');
        if (calcDayMinStaffOverrides[ymd] !== undefined) return calcDayMinStaffOverrides[ymd];
      }
      return minStaffConfig[minStaffKeyMapCheck[dt] ?? '普通工作日'] ?? 2;
    };
    // 总需求班次 = 所选月份每日最低排班人数之和
    const totalRequiredShifts = allDaysCheck.reduce((sum, day) => {
      const dt = getFinalTCheck(day);
      return sum + getMinSCheck(dt, day);
    }, 0);
    // 正常工作日数量（用于计算各成员应排班天数）
    const normalWorkDayCountCheck = allDaysCheck.filter(d => {
      const t = getFinalTCheck(d);
      return t === '工作日' || t === '假前一日' || t === '调休工作日';
    }).length;
    // 各成员请假意愿（天数）
    const leaveWishCheck: Record<string, Set<number>> = {};
    scheduledMembersCheck.forEach(m => { leaveWishCheck[m.name] = new Set(); });
    const submittedForCheckMonth = submittedLeaveData[calcMonthYMCheck] ?? {};
    Object.entries(submittedForCheckMonth).forEach(([key, type]) => {
      if (!key.startsWith(calcMonthYMCheck + '-')) return;
      const parts = key.split('-');
      const d = parseInt(parts[parts.length - 1]);
      if (type === '请假') leaveWishCheck[currentUser]?.add(d);
    });
    Object.entries(allLeaveData).forEach(([key, ents]) => {
      if (!key.startsWith(calcMonthYMCheck + '-')) return;
      const parts = key.split('-');
      const d = parseInt(parts[parts.length - 1]);
      ents.forEach(e => { if (e.type === '请假') leaveWishCheck[e.name]?.add(d); });
    });
    // 总可用班次 = 所有参与排班的成员的应排班天数之和
    const totalAvailableShifts = scheduledMembersCheck.reduce((sum, m) => {
      const legalWork = memberHolidayDays[m.name] ?? legalHolidayCountCheck;
      const leaveCnt = leaveWishCheck[m.name]?.size ?? 0;
      const requiredWorkDays = normalWorkDayCountCheck + legalWork - leaveCnt;
      return sum + requiredWorkDays;
    }, 0);
    if (totalAvailableShifts < totalRequiredShifts) {
      setShowInsufficientModal(true);
      return;
    }
    // ===== 校验结束 =====

    setCalcScheduleResult(null);
    setCalcLogs([]);
    setShowCalcModal(true);
    setCalcRunning(true);
    setCalcLoading(true);
    try {
      const result = await runCalcWithRetry();
      setCalcScheduleResult(result);
    } catch (e) {
      console.error(e);
    } finally {
      setCalcRunning(false);
      setCalcLoading(false);
      setCalcDone(true);
    }
  };

  // ========== Render Helpers ==========
  const calcMonthYMForWishes = format(calcMonth, 'yyyy-MM');
  const memberWishes = membersList.filter(m => m.inSchedule).map(m => ({
    name: m.name,
    role: m.role,
    offDays: getSubmittedOffDays(m.name, calcMonthYMForWishes),
    leaveDays: getSubmittedLeaveDays(m.name, calcMonthYMForWishes),
    submitted: m.name === currentUser
      ? hasSubmittedForMonth(calcMonthYMForWishes)
      : getSubmittedOffDays(m.name, calcMonthYMForWishes) + getSubmittedLeaveDays(m.name, calcMonthYMForWishes) > 0,
  }));
  const submittedCount = memberWishes.filter(m => m.submitted).length;
  const totalMembers = memberWishes.length;

  const refDate = startOfMonth(new Date());
  const monthOptions = [-2, -1, 0, 1, 2, 3].map(offset => addMonths(refDate, offset));
  const calcMonthYMStr = format(calcMonth, 'yyyy-MM');
  const firstMonthYM = format(monthOptions[0], 'yyyy-MM');
  const lastMonthYM = format(monthOptions[monthOptions.length - 1], 'yyyy-MM');
  const isAtMinMonth = calcMonthYMStr === firstMonthYM;
  const isAtMaxMonth = calcMonthYMStr === lastMonthYM;

  const mCalcPrefix = format(calcMonth, 'yyyy/MM');
  const holidayConfig = globalHolidayConfig
    .filter(h => h.date.startsWith(mCalcPrefix))
    .map(h => ({
      date: h.date.replace(/\//g, '-'),
      type: (h.type === '节假日' ? '法定节假日' : '调休工作日') as '法定节假日' | '调休工作日',
      label: h.name,
      isLegal: h.isLegal,
    }));
  const legalHolidayCount = globalHolidayConfig.filter(h => h.isLegal && h.date.startsWith(mCalcPrefix)).length;

  function getBaseType(date: Date): '工作日' | '周末' | '法定节假日' | '调休工作日' {
    const ymd = format(date, 'yyyy-MM-dd');
    const override = calcDayTypeOverrides[ymd];
    if (override) return override;
    const hol = holidayConfig.find(h => h.date === ymd);
    if (hol) return hol.type;
    const dow = getDay(date);
    if (dow === 0 || dow === 6) return '周末';
    return '工作日';
  }

  function getFinalType(date: Date): { type: string; label: string; isAutoPreHoliday: boolean } {
    const base = getBaseType(date);
    if (base === '工作日') {
      const nextBase = getBaseType(addDays(date, 1));
      if (nextBase === '周末' || nextBase === '法定节假日') {
        const hol = holidayConfig.find(h => h.date === format(date, 'yyyy-MM-dd'));
        return { type: '假前一日', label: hol?.label ?? '', isAutoPreHoliday: true };
      }
    }
    const hol = holidayConfig.find(h => h.date === format(date, 'yyyy-MM-dd'));
    return { type: base, label: hol?.label ?? '', isAutoPreHoliday: false };
  }

  const monthStart = startOfMonth(calcMonth);
  const monthEnd = endOfMonth(calcMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDow = getDay(monthStart);

  const calcMonthTotalDays = days.length;
  const calcWorkdayCount = days.filter(d => { const t = getFinalType(d).type; return t === '工作日' || t === '假前一日'; }).length;
  const calcMakeupWorkdayCount = days.filter(d => getFinalType(d).type === '调休工作日').length;
  const getMonthlyQuota = (memberName: string) =>
    Math.max(0, calcMonthTotalDays - calcWorkdayCount - calcMakeupWorkdayCount - (memberHolidayDays[memberName] ?? legalHolidayCount));

  const typeBg: Record<string, string> = {
    '工作日': 'bg-white', '假前一日': 'bg-orange-50', '周末': 'bg-yellow-50',
    '法定节假日': 'bg-green-50', '调休工作日': 'bg-purple-50',
  };
  const typeText: Record<string, string> = {
    '工作日': 'text-gray-700', '假前一日': 'text-orange-500', '周末': 'text-yellow-600',
    '法定节假日': 'text-green-600', '调休工作日': 'text-purple-600',
  };
  const typeDot: Record<string, string> = {
    '工作日': 'bg-gray-300', '假前一日': 'bg-orange-400', '周末': 'bg-yellow-400',
    '法定节假日': 'bg-green-500', '调休工作日': 'bg-purple-500',
  };

  const progressMonthYM = format(calcMonth, 'yyyy-MM');
  const prevMonthStart = startOfMonth(subMonths(calcMonth, 1));
  const day18OfPrev = addDays(prevMonthStart, 17);
  const day20OfPrev = addDays(prevMonthStart, 19);
  const day22OfPrev = addDays(prevMonthStart, 21);
  const hasSavedPlan = savedSchedules.some(s => s.month === progressMonthYM);
  const hasPublishedPlan = !!appliedSchedules[progressMonthYM];
  const todayTs = currentDate.getTime();
  const effectivePrefillOpen = prefillOpenMap[progressMonthYM] !== undefined
    ? prefillOpenMap[progressMonthYM]
    : (todayTs >= day20OfPrev.getTime());
  const node2Status: 'done' | 'progress' | 'todo' =
    (submittedCount > 0 && hasSavedPlan) ? 'done' :
      submittedCount > 0 ? 'progress' :
        todayTs >= day22OfPrev.getTime() ? 'done' :
          todayTs >= day20OfPrev.getTime() ? 'progress' : 'todo';
  const node1Status: 'done' | 'progress' | 'todo' =
    (node2Status === 'done' || node2Status === 'progress') ? 'done' :
      todayTs >= day20OfPrev.getTime() ? 'done' :
        (todayTs >= day18OfPrev.getTime() || submittedCount > 0) ? 'progress' : 'todo';
  const node3Status: 'done' | 'progress' | 'todo' =
    hasPublishedPlan ? 'done' : hasSavedPlan ? 'progress' : 'todo';
  const node4Status: 'done' | 'progress' | 'todo' =
    !hasPublishedPlan ? 'todo' :
    confirmStats && confirmStats.confirmed > 0 && confirmStats.total > 0 && confirmStats.confirmed >= confirmStats.total ? 'done' :
    confirmStats && confirmStats.confirmed > 0 ? 'progress' : 'todo';
  const node4Label =
    node4Status === 'done' ? '已全部确认' :
    node4Status === 'progress' && confirmStats ? `确认中` : '未开始';
  const node4Sub =
    node4Status === 'progress' && confirmStats ? `${confirmStats.confirmed}/${confirmStats.total}` : undefined;

  // viewing schedule modal helpers
  const shiftStyle: Record<string, string> = {
    '早': 'bg-blue-100 text-blue-700 border-blue-200',
    '晚': 'bg-indigo-100 text-indigo-700 border-indigo-200',
    '休': 'bg-orange-50 text-orange-500 border-orange-200',
    '假': 'bg-red-50 text-red-500 border-red-200',
  };

  return (
    <div className="max-w-[1200px] mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4">
      {/* 筛选行 */}
      <div className="flex items-end gap-2">
        <button
          onClick={() => { if (!isAtMinMonth) setCalcMonth(m => subMonths(m, 1)); }}
          disabled={isAtMinMonth}
          className={`h-9 px-3 rounded-xl border border-gray-200 bg-white text-sm font-bold flex items-center gap-1 transition-colors shadow-sm ${isAtMinMonth ? 'text-gray-300 cursor-not-allowed' : 'text-gray-700 hover:bg-gray-50'}`}
        >
          <ChevronLeft size={15} /> 上一月
        </button>
        <div className="flex flex-col">
          <label className="text-[10px] font-bold text-gray-400 mb-0.5 ml-0.5 tracking-wide">请选择月份</label>
          <select
            value={format(calcMonth, 'yyyy-MM')}
            onChange={e => setCalcMonth(startOfMonth(new Date(e.target.value + '-01')))}
            className="h-9 px-3 rounded-xl border border-gray-200 bg-white text-sm font-bold text-gray-800 shadow-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all min-w-[140px]"
          >
            {monthOptions.map(m => (
              <option key={format(m, 'yyyy-MM')} value={format(m, 'yyyy-MM')}>
                {format(m, 'yyyy年MM月')}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={() => { if (!isAtMaxMonth) setCalcMonth(m => addMonths(m, 1)); }}
          disabled={isAtMaxMonth}
          className={`h-9 px-3 rounded-xl border border-gray-200 bg-white text-sm font-bold flex items-center gap-1 transition-colors shadow-sm ${isAtMaxMonth ? 'text-gray-300 cursor-not-allowed' : 'text-gray-700 hover:bg-gray-50'}`}
        >
          下一月 <ChevronRight size={15} />
        </button>
      </div>

      {/* 页头统计 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
            <span className="bg-zinc-900 text-white p-2 rounded-2xl"><Cpu size={24} /></span>
            排班计算
          </h1>
          <p className="text-sm text-gray-400 mt-1 font-medium">基于成员预填意愿，一键生成下月排班草案</p>
        </div>
        <div className="flex items-center gap-3 text-sm font-bold">
          <span className="text-gray-400">已提交：</span>
          <span className={`text-2xl font-black ${submittedCount === totalMembers ? 'text-green-600' : 'text-orange-500'}`}>{submittedCount}</span>
          <span className="text-gray-300">/</span>
          <span className="text-2xl font-black text-gray-900">{totalMembers}</span>
          <span className="text-gray-400">人</span>
        </div>
      </div>

      {/* 排班进度 */}
      <div className="bg-white rounded-[2rem] border shadow-xl overflow-hidden">
        <div className="px-8 py-5 border-b bg-gray-50/80 flex items-center gap-3">
          <Activity size={18} className="text-zinc-500" />
          <h2 className="text-base font-black text-gray-900 tracking-tight">{format(calcMonth, 'yyyy年MM月')}排班进度</h2>
        </div>
        <div className="px-12 py-8">
          <div className="flex items-start">
            {[
              { status: node1Status, label: '确认排班配置', sub: '前月18~20日', statusLabel: (s: string) => s === 'done' ? '已完成' : s === 'progress' ? '进行中' : '未开始', extraSub: undefined as string | undefined },
              { status: node2Status, label: '轮休意愿采集', sub: '前月20~22日', statusLabel: (s: string) => s === 'done' ? '已完成' : s === 'progress' ? '进行中' : '未开始', extraSub: undefined as string | undefined },
              { status: node3Status, label: '排班计算', sub: '前月22日后', statusLabel: (s: string) => s === 'done' ? '已完成' : s === 'progress' ? '进行中' : '未开始', extraSub: undefined as string | undefined },
              { status: node4Status, label: '确认排班', sub: '排班发布后', statusLabel: (_s: string) => node4Label, extraSub: node4Sub },
            ].map((node, ni) => (
              <React.Fragment key={ni}>
                {ni > 0 && (
                  <div className="flex-1 pt-5">
                    <div className="relative h-1 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`absolute left-0 h-full rounded-full transition-all duration-700 ${
                        node.status === 'done' ? 'w-full bg-green-400' :
                        node.status === 'progress' ? 'w-1/2 bg-amber-300' : 'w-0'
                      }`} />
                    </div>
                  </div>
                )}
                <div className="flex flex-col items-center" style={{ minWidth: 140 }}>
                  <div className={`w-11 h-11 rounded-full flex items-center justify-center shadow-md transition-all ${
                    node.status === 'done' ? 'bg-green-500 text-white' :
                    node.status === 'progress' ? 'bg-amber-400 text-white' :
                    'bg-gray-100 text-gray-400 border-2 border-dashed border-gray-200'
                  }`}>
                    {node.status === 'done' ? <CheckCircle2 size={18} /> :
                      node.status === 'progress' ? <Clock size={17} /> :
                      <span className="text-sm font-black">{ni + 1}</span>}
                  </div>
                  <div className="mt-3 text-center">
                    <div className="text-xs font-black text-gray-800">{node.label}</div>
                    <div className={`text-[10px] font-bold mt-0.5 ${
                      node.status === 'done' ? 'text-green-500' :
                      node.status === 'progress' ? 'text-amber-500' : 'text-gray-300'
                    }`}>
                      {node.extraSub && <span className="mr-0.5">{node.extraSub}</span>}
                      {node.statusLabel(node.status)}
                    </div>
                    <div className="text-[10px] text-gray-300 mt-0.5">{node.sub}</div>
                  </div>
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* 预设休息日统计表 */}
      <div className="bg-white rounded-[2rem] border shadow-xl overflow-hidden">
        <div className="px-8 py-5 border-b bg-gray-50/80 flex items-center gap-3">
          <Activity size={18} className="text-zinc-500" />
          <h2 className="text-base font-black text-gray-900 tracking-tight">预设休息日统计</h2>
          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-500">开放预填</span>
              <button
                onClick={() => {
                  const next = !effectivePrefillOpen;
                  setPrefillOpenMap(prev => ({ ...prev, [progressMonthYM]: next }));
                  paibanFetch('/api/paiban/prefill/status', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ month: progressMonthYM, open: next }),
                  }).catch(() => {});
                }}
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none ${effectivePrefillOpen ? 'bg-green-500' : 'bg-gray-200'}`}
              >
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${effectivePrefillOpen ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
              <span className="text-[10px] font-medium text-gray-400">将于每月20日自动开放次月预填</span>
            </div>
            <div className="w-px h-4 bg-gray-200" />
            <button
              onClick={() => setEditingCalcHoliday(e => !e)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${editingCalcHoliday ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
            >
              {editingCalcHoliday ? <><CheckCircle2 size={13} /> 保存</> : <><RefreshCw size={13} /> 编辑</>}
            </button>
            <span className="text-xs font-bold text-gray-400">额度 = 当月天数 − 工作日 − 调休工作日 − 法定加班</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b text-xs font-bold text-gray-500 uppercase tracking-wide">
                <th className="px-6 py-3 text-left w-52">成员</th>
                <th className="px-4 py-3 text-center min-w-[180px]">预填统计</th>
                <th className="px-4 py-3 text-center w-28">额外请假</th>
                <th className="px-4 py-3 text-center w-36">法定节假日排班</th>
                <th className="px-4 py-3 text-center w-28">剩余额度</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {memberWishes.map((m, i) => {
                const quota = getMonthlyQuota(m.name);
                const offPct = Math.min(100, quota > 0 ? Math.round(m.offDays / quota * 100) : 0);
                const remaining = quota - m.offDays;
                const hdDays = memberHolidayDays[m.name] ?? legalHolidayCount;
                return (
                  <tr key={i} className="hover:bg-gray-50/40 transition-all">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-4">
                        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-base shadow-md ${m.submitted ? 'bg-zinc-900 text-white' : 'bg-gray-100 text-gray-400'}`}>{m.name[0]}</div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-black text-gray-900 text-sm">{m.name}</span>
                            {m.submitted
                              ? <CheckCircle2 size={14} className="text-green-500" />
                              : <span className="text-[10px] font-bold text-orange-400 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-100">未提交</span>
                            }
                          </div>
                          <span className="text-[11px] text-gray-400 font-medium">{m.role}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-5">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[11px] font-bold text-gray-400">休息日预填</span>
                        <span className="text-[11px] font-black text-orange-600">{m.offDays}<span className="text-gray-400 font-medium">/{quota}</span> 天</span>
                      </div>
                      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-700 ${offPct >= 100 ? 'bg-green-500' : offPct > 60 ? 'bg-orange-400' : 'bg-gray-200'}`} style={{ width: `${offPct}%` }} />
                      </div>
                    </td>
                    <td className="px-4 py-5 text-center">
                      <div className={`text-2xl font-black ${m.leaveDays > 0 ? 'text-red-500' : 'text-gray-200'}`}>
                        {m.leaveDays}<span className="text-xs font-bold text-gray-400 ml-1">天</span>
                      </div>
                    </td>
                    <td className="px-4 py-5 text-center">
                      {editingCalcHoliday ? (
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setMemberHolidayDays({ ...memberHolidayDays, [m.name]: Math.max(0, (memberHolidayDays[m.name] ?? legalHolidayCount) - 1) })}
                            className="w-6 h-6 rounded-lg bg-gray-100 hover:bg-gray-200 font-black text-gray-600 flex items-center justify-center transition-colors"
                          >−</button>
                          <span className={`text-xl font-black w-8 text-center ${hdDays > 0 ? 'text-indigo-600' : 'text-gray-300'}`}>{hdDays}</span>
                          <button
                            disabled={(memberHolidayDays[m.name] ?? legalHolidayCount) >= legalHolidayCount}
                            onClick={() => setMemberHolidayDays({ ...memberHolidayDays, [m.name]: Math.min(legalHolidayCount, (memberHolidayDays[m.name] ?? legalHolidayCount) + 1) })}
                            className="w-6 h-6 rounded-lg bg-gray-100 hover:bg-gray-200 font-black text-gray-600 flex items-center justify-center transition-colors disabled:opacity-30"
                          >+</button>
                        </div>
                      ) : (
                        <span className={`text-2xl font-black ${hdDays > 0 ? 'text-indigo-600' : 'text-gray-300'}`}>{hdDays}</span>
                      )}
                      <div className="text-[10px] text-gray-400 mt-0.5">天</div>
                    </td>
                    <td className="px-4 py-5 text-center">
                      <div className={`text-2xl font-black ${remaining < 0 ? 'text-red-500' : remaining === 0 ? 'text-green-600' : 'text-gray-400'}`}>
                        {remaining}<span className="text-xs font-bold text-gray-400 ml-1">天</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-zinc-50 border-t">
                <td className="px-6 py-4 font-black text-gray-900">全组汇总</td>
                <td className="px-4 py-4 text-xs text-gray-500">
                  轮休：<span className="font-black text-orange-600">{memberWishes.reduce((a, m) => a + m.offDays, 0)}</span>天已填
                  &nbsp;请假：<span className="font-black text-red-500">{memberWishes.reduce((a, m) => a + m.leaveDays, 0)}</span>天
                  &nbsp;待消化：<span className="font-black text-gray-700">{memberWishes.reduce((a, m) => a + Math.max(0, getMonthlyQuota(m.name) - m.offDays), 0)}</span>天
                </td>
                <td className="px-4 py-4 text-center text-gray-300">—</td>
                <td className="px-4 py-4 text-center text-xs text-gray-500">
                  共 <span className="font-black text-indigo-600 text-sm">{Object.values(memberHolidayDays).reduce((a, v) => a + v, 0)}</span> 天
                </td>
                <td className="px-4 py-4 text-center text-gray-300">—</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* 日历 */}
      <div className="rounded-[2rem] overflow-hidden shadow-xl border border-zinc-200">
        <div className="bg-zinc-900 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CalendarDays size={18} className="text-zinc-400" />
            <span className="text-white font-black text-base">{format(calcMonth, 'yyyy年MM月')} · 日历</span>
          </div>
          <div className="flex items-center gap-2">
            {editingCalcCalendar && (
              <button
                onClick={() => {
                  setCalcDayTypeOverrides(calcDayTypeOverridesDraft);
                  setCalcDayMinStaffOverrides(() => calcDayMinStaffOverridesDraft);
                  setEditingCalcCalendar(false);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all bg-white/10 text-zinc-300 border-white/20 hover:bg-white/20"
              >
                取消
              </button>
            )}
            <button
              onClick={() => {
                if (editingCalcCalendar) {
                  const maxStaff = membersList.filter(m => m.inSchedule).length;
                  const overLimit = days.some(d => {
                    const ymd = format(d, 'yyyy-MM-dd');
                    const { type } = getFinalType(d);
                    const dayMinStaffKey: Record<string, string> = {
                      '工作日': '普通工作日', '假前一日': '假前一日', '周末': '周末',
                      '法定节假日': '法定节假日', '调休工作日': '调休工作日',
                    };
                    const val = calcDayMinStaffOverrides[ymd] ?? (minStaffConfig[dayMinStaffKey[type] ?? '普通工作日'] ?? 2);
                    return val > maxStaff;
                  });
                  if (overLimit) { alert('超出客服最大人数'); return; }
                  setCalcDayTypeOverrides(prev => {
                    const next = { ...prev };
                    days.forEach(d => {
                      const ymd = format(d, 'yyyy-MM-dd');
                      const getB = (dt: Date): string => {
                        const k = format(dt, 'yyyy-MM-dd');
                        if (next[k]) return next[k];
                        const h = holidayConfig.find(x => x.date === k);
                        if (h) return h.type;
                        const w = getDay(dt);
                        return (w === 0 || w === 6) ? '周末' : '工作日';
                      };
                      if (getB(d) === '工作日') {
                        const nb = getB(addDays(d, 1));
                        if (nb === '周末' || nb === '法定节假日') delete next[ymd];
                      }
                    });
                    return next;
                  });
                  setEditingCalcCalendar(false);
                  // 持久化当月每日最低人数覆盖到服务端
                  const calcMonthYM2 = format(calcMonth, 'yyyy-MM');
                  const monthOverrides: Record<string, number> = {};
                  Object.entries(calcDayMinStaffOverrides).forEach(([date, val]) => {
                    if (date.startsWith(calcMonthYM2)) monthOverrides[date] = val;
                  });
                  paibanFetch('/api/paiban/min-staff-override/batch-save', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ month: calcMonthYM2, overrides: monthOverrides }),
                  }).catch(() => {});
                } else {
                  setCalcDayTypeOverridesDraft({ ...calcDayTypeOverrides });
                  setCalcDayMinStaffOverridesDraft({ ...calcDayMinStaffOverrides });
                  setEditingCalcCalendar(true);
                }
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${editingCalcCalendar ? 'bg-white text-zinc-900 border-white' : 'bg-white/10 text-zinc-300 border-white/20 hover:bg-white/20'}`}
            >
              {editingCalcCalendar ? <><CheckCircle2 size={13} /> 保存</> : <><RefreshCw size={13} /> 编辑日历</>}
            </button>
          </div>
        </div>
        <div className="bg-zinc-800 px-6 py-2.5 flex items-center gap-5 flex-wrap">
          {(['工作日', '假前一日', '周末', '法定节假日', '调休工作日'] as const).map(t => (
            <div key={t} className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${typeDot[t]}`} />
              <span className="text-xs text-zinc-400 font-medium">{t}</span>
            </div>
          ))}
          {editingCalcCalendar && (
            <span className="text-[10px] text-zinc-500 ml-auto font-medium italic">· 编辑模式：可修改日期类型与每日最低排班人数，保存后自动修正假前一日</span>
          )}
        </div>
        <div className="bg-zinc-800 border-t border-zinc-700 grid grid-cols-7">
          {['日', '一', '二', '三', '四', '五', '六'].map(d => (
            <div key={d} className="py-2 text-center text-xs font-black text-zinc-500 tracking-widest">{d}</div>
          ))}
        </div>
        <div className="bg-gray-50 p-3 grid grid-cols-7 gap-1.5">
          {Array.from({ length: startDow }).map((_, i) => (
            <div key={`blank-${i}`} className="rounded-xl bg-white/0" />
          ))}
          {days.map((d, i) => {
            const { type, label } = getFinalType(d);
            const ymd = format(d, 'yyyy-MM-dd');
            const bg = typeBg[type] ?? 'bg-white';
            const tc = typeText[type] ?? 'text-gray-700';
            const editValue = calcDayTypeOverrides[ymd] ?? (type === '假前一日' ? '工作日' : getBaseType(d));
            const dayMinStaffKey: Record<string, string> = {
              '工作日': '普通工作日', '假前一日': '假前一日', '周末': '周末',
              '法定节假日': '法定节假日', '调休工作日': '调休工作日',
            };
            const effectiveMinStaff = calcDayMinStaffOverrides[ymd] ?? (minStaffConfig[dayMinStaffKey[type] ?? '普通工作日'] ?? 2);
            return (
              <div key={i} className={`${bg} rounded-xl border border-gray-100 p-2 flex flex-col min-h-[88px] transition-all ${editingCalcCalendar ? 'hover:border-zinc-400' : ''} relative`}>
                <div className="flex items-start justify-between">
                  <span className={`text-lg font-black leading-none ${tc}`}>{format(d, 'd')}</span>
                  {!editingCalcCalendar && (
                    <span className="text-[9px] font-bold text-gray-400 bg-gray-100 rounded px-1 py-0.5 leading-none" title="最低排班人数">
                      {effectiveMinStaff}人
                    </span>
                  )}
                </div>
                <span className={`text-[10px] font-bold mt-1 ${tc}`}>
                  {(() => {
                    const calcHol = holidayConfig.find(h => h.date === ymd);
                    if (calcHol) return calcHol.isLegal ? `${calcHol.label}·法定节假日` : calcHol.label;
                    return type;
                  })()}
                </span>
                {editingCalcCalendar && (
                  <div className="mt-auto pt-1 flex flex-col gap-1">
                    <select
                      value={editValue}
                      onChange={e => setCalcDayTypeOverrides(prev => ({ ...prev, [ymd]: e.target.value as '工作日' | '周末' | '法定节假日' | '调休工作日' }))}
                      className="select-compact text-[10px] font-bold bg-white border border-gray-200 rounded-lg w-full cursor-pointer focus:outline-none focus:ring-1 focus:ring-zinc-400 px-1 py-0.5"
                      onClick={e => e.stopPropagation()}
                    >
                      <option value="工作日">工作日</option>
                      <option value="周末">周末</option>
                      <option value="法定节假日">法定节假日</option>
                      <option value="调休工作日">调休工作日</option>
                    </select>
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] text-gray-400 whitespace-nowrap">最低</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={effectiveMinStaff}
                        onChange={e => {
                          const val = parseInt(e.target.value);
                          if (e.target.value === '') {
                            setCalcDayMinStaffOverrides(prev => ({ ...prev, [ymd]: 0 }));
                          } else if (!isNaN(val) && val >= 0 && val <= 99) {
                            setCalcDayMinStaffOverrides(prev => ({ ...prev, [ymd]: val }));
                          }
                        }}
                        className="text-[10px] font-bold bg-white border border-gray-200 rounded-lg w-full focus:outline-none focus:ring-1 focus:ring-zinc-400 px-1 py-0.5 text-center"
                        onClick={e => e.stopPropagation()}
                      />
                      <span className="text-[9px] text-gray-400 whitespace-nowrap">人</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 已保存排班方案列表 */}
      {savedSchedules.filter(s => s.month === format(calcMonth, 'yyyy-MM')).length > 0 && (
        <div className="bg-white rounded-[2rem] border shadow-xl overflow-hidden">
          <div className="px-8 py-5 border-b bg-gray-50/80 flex items-center gap-3">
            <CalendarDays size={18} className="text-zinc-500" />
            <h2 className="text-base font-black text-gray-900 tracking-tight">已保存方案</h2>
            <span className="text-xs text-gray-400 ml-1">· {format(calcMonth, 'yyyy年MM月')}</span>
          </div>
          <div className="divide-y">
            {savedSchedules.filter(s => s.month === format(calcMonth, 'yyyy-MM')).map(s => (
              <div key={s.id} className="px-8 py-4 flex items-center justify-between hover:bg-gray-50/40">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-zinc-900 text-white flex items-center justify-center">
                    <CalendarDays size={16} />
                  </div>
                  <div>
                    <div className="font-black text-gray-900 text-sm">{s.planName}</div>
                    <div className="text-[11px] text-gray-400">{s.month}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setViewingScheduleMode('calendar'); setViewingDraft(null); setViewingSchedule(s); }}
                    className="px-3 py-2 rounded-xl border border-gray-200 text-sm font-bold text-gray-700 hover:bg-gray-50 transition-all flex items-center gap-1.5"
                  >
                    <CalendarIcon size={13} /> 查看方案
                  </button>
                  <button
                    onClick={() => handleApply(s)}
                    className="px-3 py-2 rounded-xl border border-blue-200 bg-blue-50 text-sm font-bold text-blue-700 hover:bg-blue-100 transition-all flex items-center gap-1.5"
                  >
                    <CheckCircle2 size={13} /> 应用方案
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(s.id)}
                    className="px-3 py-2 rounded-xl border border-red-200 bg-red-50 text-sm font-bold text-red-600 hover:bg-red-100 transition-all flex items-center gap-1.5"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" /></svg>
                    删除方案
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 计算按钮区域 */}
      <div className={`rounded-[2rem] border-2 p-8 flex items-center justify-between gap-8 transition-all ${calcDone ? 'bg-green-50 border-green-200' : 'bg-white border-gray-100 shadow-xl'}`}>
        <div>
          <h3 className="text-xl font-black text-gray-900">
            {calcDone ? '🎉 排班草案已生成！' : '准备就绪，开始计算'}
          </h3>
          <p className="text-sm text-gray-400 mt-1">
            {calcDone
              ? '系统已根据成员意愿完成排班草案生成，请前往【排班看板】查看结果'
              : `已收集 ${submittedCount}/${totalMembers} 人意愿，算法将优先尊重轮休申请，并确保每日早晚班最低人力覆盖`
            }
          </p>
        </div>
        <button
          onClick={handleCalc}
          disabled={calcLoading}
          className={`shrink-0 px-12 py-5 rounded-[1.5rem] font-black text-lg shadow-2xl transition-all active:scale-95 flex items-center gap-3 ${
            calcLoading ? 'bg-zinc-700 text-white cursor-not-allowed' : 'bg-zinc-900 text-white hover:bg-black shadow-zinc-200'
          }`}
        >
          {calcLoading ? <><Loader2 size={22} className="animate-spin" /> 计算中...</> : <><Cpu size={22} /> 开始排班计算</>}
        </button>
      </div>

      {/* 排班计算日志弹窗 */}
      {showCalcModal && (
        <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget && !calcRunning) setShowCalcModal(false); }}>
          <div className="bg-white rounded-[2rem] shadow-2xl flex flex-col w-full max-w-3xl max-h-[85vh] overflow-hidden">
            <div className="bg-zinc-900 px-6 py-4 flex items-center gap-3 shrink-0">
              <Cpu size={18} className="text-zinc-400" />
              <span className="text-white font-black text-base">{calcRunning ? '排班计算中...' : '排班计算完成'}</span>
              <div className="ml-auto flex items-center gap-2">
                {calcRunning && <Loader2 size={16} className="text-zinc-400 animate-spin" />}
                {!calcRunning && (
                  <button onClick={() => setShowCalcModal(false)} className="text-zinc-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12" /></svg>
                  </button>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto bg-zinc-950 p-5 font-mono text-xs leading-5">
              {calcLogs.map((line, i) => (
                <div key={i} className={`whitespace-pre-wrap ${
                  line.startsWith('  ⚠️') ? 'text-orange-400' :
                  line.startsWith('  ⚡') ? 'text-yellow-400' :
                  line.startsWith('  📝') ? 'text-sky-400' :
                  line.startsWith('✅') ? 'text-green-400 font-bold' :
                  line.startsWith('📅') ? 'text-white font-bold' :
                  line.startsWith('📋') ? 'text-zinc-300 font-bold' :
                  line.startsWith('🔍') || line.startsWith('🔄') || line.startsWith('⚡') ? 'text-zinc-300 font-bold' :
                  line.startsWith('  ✅') ? 'text-green-500' :
                  line.startsWith('  ') ? 'text-zinc-400' :
                  'text-zinc-500'
                }`}>{line || '\u00a0'}</div>
              ))}
              {calcRunning && <div className="text-zinc-500 animate-pulse mt-1">▌</div>}
            </div>
            {!calcRunning && calcScheduleResult && (
              <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-end gap-3 shrink-0">
                <button
                  onClick={async () => {
                    setCalcScheduleResult(null); setCalcLogs([]); setCalcDone(false);
                    setShowCalcModal(true); setCalcRunning(true); setCalcLoading(true);
                    try { const result = await runCalcWithRetry(); setCalcScheduleResult(result); }
                    catch (e) { console.error(e); }
                    finally { setCalcRunning(false); setCalcLoading(false); setCalcDone(true); }
                  }}
                  className="px-5 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-bold text-gray-700 hover:bg-gray-50 transition-all flex items-center gap-2"
                >
                  <RefreshCw size={14} /> 重新排班
                </button>
                <button
                  onClick={() => { setSavePlanName(''); setShowSaveNameModal(true); }}
                  className="px-5 py-2.5 rounded-xl bg-zinc-900 text-white text-sm font-bold hover:bg-black transition-all flex items-center gap-2 shadow-lg"
                >
                  <CheckCircle2 size={14} /> 保存排班
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 应用方案 — 覆盖确认弹窗 */}
      {showApplyOverwriteConfirm && (
        <div className="fixed inset-0 z-[500] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm p-8 space-y-5">
            <h3 className="text-xl font-black text-gray-900">确认覆盖排班</h3>
            <p className="text-sm text-gray-500">当前月份（{showApplyOverwriteConfirm.month.replace('-', '年') + '月'}）已存在应用的排班，请确认是否覆盖。</p>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowApplyOverwriteConfirm(null)} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-all">取消</button>
              <button onClick={() => doApply(showApplyOverwriteConfirm)} className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-all">确认覆盖</button>
            </div>
          </div>
        </div>
      )}

      {/* 应用方案 — 成功提示弹窗 */}
      {showApplySuccess && (
        <div className="fixed inset-0 z-[500] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm p-8 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 size={20} className="text-green-600" />
              </div>
              <h3 className="text-xl font-black text-gray-900">应用成功</h3>
            </div>
            <p className="text-sm text-gray-500">请前往排班看板处查看。</p>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowApplySuccess(null)} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-all">好的</button>
              <button onClick={() => navigateToBoardMonth(showApplySuccess)} className="flex-1 px-4 py-2.5 rounded-xl bg-zinc-900 text-white text-sm font-bold hover:bg-black transition-all">前往查看</button>
            </div>
          </div>
        </div>
      )}

      {/* 保存排班方案命名弹窗 */}
      {showSaveNameModal && (
        <div className="fixed inset-0 z-[400] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm p-8 space-y-5">
            <h3 className="text-xl font-black text-gray-900">保存排班方案</h3>
            <div>
              <label className="text-xs font-bold text-gray-500 mb-1 block">方案名称 <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={savePlanName}
                onChange={e => setSavePlanName(e.target.value)}
                placeholder="如：4月排班方案 v1"
                autoFocus
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-zinc-900"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowSaveNameModal(false)} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-all">取消</button>
              <button
                disabled={!savePlanName.trim()}
                onClick={async () => {
                  if (!savePlanName.trim() || !calcScheduleResult) return;
                  const planId = Date.now().toString();
                  const newPlan: SavedSchedule = {
                    id: planId,
                    planName: savePlanName.trim(),
                    month: format(calcMonth, 'yyyy-MM'),
                    schedule: calcScheduleResult,
                  };
                  try {
                    await paibanFetch('/api/paiban/saved-schedule/save', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        planId,
                        planName: newPlan.planName,
                        month: newPlan.month,
                        schedule: newPlan.schedule,
                      }),
                    });
                  } catch (_) { /* 忽略网络错误，仍写本地 */ }
                  setSavedSchedules(prev => [newPlan, ...prev]);
                  setShowSaveNameModal(false);
                  setShowCalcModal(false);
                }}
                className="flex-1 px-4 py-2.5 rounded-xl bg-zinc-900 text-white text-sm font-bold hover:bg-black transition-all disabled:opacity-40"
              >确认保存</button>
            </div>
          </div>
        </div>
      )}

      {/* 查看已保存方案弹窗 */}
      {viewingSchedule && (() => {
        const vMonth = new Date(viewingSchedule.month + '-01');
        const vStart = startOfMonth(vMonth);
        const vEnd = endOfMonth(vStart);
        const vCalDays = eachDayOfInterval({ start: startOfWeek(vStart, { weekStartsOn: 1 }), end: endOfWeek(vEnd, { weekStartsOn: 1 }) });
        const vTableDays = eachDayOfInterval({ start: vStart, end: vEnd });
        const vHolPrefix = format(vMonth, 'yyyy/MM');
        const vHols = globalHolidayConfig.filter(h => h.date.startsWith(vHolPrefix));
        const vPubHols = new Set(vHols.filter(h => h.type === '节假日').map(h => h.date.replace(/\//g, '-')));
        const vMakeup = new Set(vHols.filter(h => h.type === '调休上班日').map(h => h.date.replace(/\//g, '-')));
        const getVDayBg = (day: Date) => {
          const ymd = format(day, 'yyyy-MM-dd');
          if (vPubHols.has(ymd)) return 'bg-green-50';
          if (vMakeup.has(ymd)) return 'bg-purple-50';
          const dow = getDay(day);
          if (dow === 0 || dow === 6) return 'bg-yellow-50';
          return '';
        };
        const getVDayTag = (day: Date) => {
          const ymd = format(day, 'yyyy-MM-dd');
          if (vPubHols.has(ymd)) return { label: '节假日', cls: 'text-green-700 bg-green-100 border-green-200' };
          if (vMakeup.has(ymd)) return { label: '调休日', cls: 'text-purple-700 bg-purple-100 border-purple-200' };
          const dow = getDay(day);
          if (dow === 0 || dow === 6) return { label: '周末', cls: 'text-yellow-600 bg-yellow-100 border-yellow-200' };
          return null;
        };
        const today = format(new Date(2026, 2, 5), 'yyyy-MM-dd');
        const draft = viewingDraft ?? viewingSchedule.schedule;
        const scheduledMembersList = membersList.filter(m => draft[m.name] && Object.keys(draft[m.name]).length > 0);

        const getVDayTypeKey = (day: Date): string => {
          const ymd = format(day, 'yyyy-MM-dd');
          if (vPubHols.has(ymd)) return '法定节假日';
          if (vMakeup.has(ymd)) return '调休工作日';
          const dow = getDay(day);
          if (dow === 0 || dow === 6) return '周末';
          if (vPubHols.has(format(addDays(day, 1), 'yyyy-MM-dd'))) return '假前一日';
          return '普通工作日';
        };

        const rule1Bad: string[] = [];
        scheduledMembersList.forEach(m => {
          let consec = 0;
          for (const day of vTableDays) {
            const dn = parseInt(format(day, 'd'));
            const s = draft[m.name]?.[dn];
            if (s === '早' || s === '晚') { consec++; if (consec > 6) { rule1Bad.push(m.name); break; } }
            else consec = 0;
          }
        });
        const rule2Bad: string[] = [];
        scheduledMembersList.forEach(m => {
          for (let i = 0; i < vTableDays.length - 1; i++) {
            const d1 = parseInt(format(vTableDays[i], 'd'));
            const d2 = parseInt(format(vTableDays[i + 1], 'd'));
            if (draft[m.name]?.[d1] === '晚' && draft[m.name]?.[d2] === '早') { rule2Bad.push(m.name); break; }
          }
        });
        const vLegalHolidayCount2 = vHols.filter(h => h.isLegal).length;
        const vNormalWorkDayCount = vTableDays.filter(d => {
          const t = getVDayTypeKey(d);
          return t === '普通工作日' || t === '假前一日' || t === '调休工作日';
        }).length;
        const rule5Bad: { name: string; actual: number; required: number }[] = [];
        scheduledMembersList.forEach(m => {
          const legalWork = memberHolidayDays[m.name] ?? vLegalHolidayCount2;
          const leaveCnt = vTableDays.filter(d => draft[m.name]?.[parseInt(format(d, 'd'))] === '假').length;
          const requiredWorkDays = vNormalWorkDayCount + legalWork - leaveCnt;
          const actualWorkDays = vTableDays.filter(d => { const s = draft[m.name]?.[parseInt(format(d, 'd'))]; return s === '早' || s === '晚'; }).length;
          if (actualWorkDays !== requiredWorkDays) rule5Bad.push({ name: m.name, actual: actualWorkDays, required: requiredWorkDays });
        });
        const hardFail = rule1Bad.length > 0 || rule2Bad.length > 0 || rule5Bad.length > 0;

        const personStats = scheduledMembersList.map(m => {
          const counts: Record<string, number> = { '早': 0, '晚': 0, '休': 0, '假': 0, '法定': 0 };
          const vLegalHols2 = new Set(vHols.filter(h => h.isLegal).map(h => h.date.replace(/\//g, '-')));
          vTableDays.forEach(day => {
            const dn = parseInt(format(day, 'd'));
            const shift = draft[m.name]?.[dn];
            if (!shift) return;
            if (shift === '早' || shift === '晚' || shift === '休' || shift === '假') counts[shift]++;
            if ((shift === '早' || shift === '晚') && vLegalHols2.has(format(day, 'yyyy-MM-dd'))) counts['法定']++;
          });
          return { name: m.name, counts };
        });

        return (
          <div className="fixed inset-0 z-[300] bg-black/70 flex items-center justify-center p-4 overflow-y-auto" onClick={e => { setViewingDropdown(null); if (e.target === e.currentTarget) setViewingSchedule(null); }}>
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-[1200px] overflow-hidden my-4" onClick={() => setViewingDropdown(null)}>
              <div className="bg-zinc-900 px-6 py-4 flex items-center gap-3">
                <CalendarDays size={18} className="text-zinc-400" />
                <span className="text-white font-black text-base">{viewingSchedule.planName} · {viewingSchedule.month}</span>
                <div className="ml-auto flex items-center gap-3">
                  <button
                    onClick={() => setViewingScheduleMode(m => m === 'calendar' ? 'table' : 'calendar')}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white text-xs font-bold transition-all"
                  >
                    {viewingScheduleMode === 'calendar' ? (
                      <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" /></svg> 表格模式</>
                    ) : (
                      <><CalendarIcon size={14} /> 日历模式</>
                    )}
                  </button>
                  <button onClick={() => setViewingSchedule(null)} className="text-zinc-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12" /></svg>
                  </button>
                </div>
              </div>

              {viewingScheduleMode === 'calendar' ? (
                <>
                  <div className="grid grid-cols-7 bg-zinc-800">
                    {['周一', '周二', '周三', '周四', '周五', '周六', '周日'].map(d => (
                      <div key={d} className="py-4 text-center text-[11px] font-black text-zinc-500 uppercase tracking-[0.3em]">{d}</div>
                    ))}
                  </div>
                  <div className="flex items-center gap-6 px-6 py-3 border-b bg-gray-50/60 text-[11px] font-bold">
                    <span className="text-gray-400 uppercase tracking-widest text-[10px]">图例</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-white border border-gray-200 inline-block"></span> 普通工作日</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-yellow-100 border border-yellow-200 inline-block"></span> 周末</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-100 border border-green-200 inline-block"></span> 法定节假日</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-purple-100 border border-purple-200 inline-block"></span> 调休日</span>
                  </div>
                  <div className="grid grid-cols-7 border-collapse">
                    {vCalDays.map((day, idx) => {
                      const isCurr = format(day, 'yyyy-MM') === viewingSchedule.month;
                      const ymd = format(day, 'yyyy-MM-dd');
                      const dn = parseInt(format(day, 'd'));
                      const bg = isCurr ? getVDayBg(day) : '';
                      const tag = isCurr ? getVDayTag(day) : null;
                      const isPast = ymd <= today;
                      return (
                        <div key={idx} className={`relative min-h-[160px] border-r border-b border-gray-100 p-3 flex flex-col ${!isCurr ? 'bg-gray-50/50' : isPast ? 'bg-gray-100' : (bg || 'bg-white')}`}>
                          {isCurr && (
                            <>
                              <div className="flex justify-between items-start mb-2">
                                <div className="flex flex-col gap-1">
                                  <span className={`text-lg font-black ${isPast ? 'text-gray-400' : 'text-gray-900'}`}>{dn}</span>
                                  {!isPast && tag && (
                                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md border self-start ${tag.cls}`}>{tag.label}</span>
                                  )}
                                </div>
                              </div>
                              <div className={`flex-1 grid grid-cols-2 gap-1 overflow-hidden min-h-0 ${isPast ? 'opacity-40' : ''}`}>
                                <div className="flex flex-col gap-0.5 border-r border-gray-100 pr-1 overflow-y-auto">
                                  <div className="text-[9px] font-bold text-blue-500 mb-0.5">早</div>
                                  {membersList.map(m => {
                                    if (draft[m.name]?.[dn] !== '早') return null;
                                    return <div key={m.name} className="text-[9px] px-1 py-0.5 rounded border truncate bg-blue-50 text-blue-700 border-blue-100">{m.name}</div>;
                                  })}
                                </div>
                                <div className="flex flex-col gap-0.5 pl-1 overflow-y-auto">
                                  <div className="text-[9px] font-bold text-indigo-500 mb-0.5">晚</div>
                                  {membersList.map(m => {
                                    if (draft[m.name]?.[dn] !== '晚') return null;
                                    return <div key={m.name} className="text-[9px] px-1 py-0.5 rounded border truncate bg-indigo-50 text-indigo-700 border-indigo-100">{m.name}</div>;
                                  })}
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="overflow-auto">
                  <table className="text-xs border-collapse" style={{ minWidth: 'max-content' }}>
                    <thead>
                      <tr className="bg-gray-50 border-b">
                        <th className="sticky left-0 z-[30] bg-gray-50 border-r px-4 py-3 text-left font-semibold text-gray-500 whitespace-nowrap" style={{ minWidth: '80px' }}>成员</th>
                        {vTableDays.map(day => {
                          const ymd = format(day, 'yyyy-MM-dd');
                          const isPast = ymd <= today;
                          const dayBg = isPast ? 'bg-gray-100 text-gray-400' : (getVDayBg(day) || 'bg-white');
                          const tag = !isPast ? getVDayTag(day) : null;
                          return (
                            <th key={format(day, 'd')} className={`px-1 py-2 text-center font-semibold border-r whitespace-nowrap ${dayBg} ${!isPast && !getVDayBg(day) ? 'text-gray-500' : ''}`} style={{ minWidth: '36px' }}>
                              <div>{format(day, 'd')}</div>
                              <div className="text-[9px] font-normal opacity-70">{format(day, 'EEE', { locale: zhCN })}</div>
                              {tag && <div className={`text-[8px] font-black px-1 rounded mt-0.5 ${tag.cls}`}>{tag.label}</div>}
                            </th>
                          );
                        })}
                        <th className="sticky right-0 z-[30] bg-gray-100 border-l py-2" style={{ width: '220px', minWidth: '220px' }}>
                          <div className="flex text-[10px]">
                            <div className="flex-1 text-center font-semibold text-blue-600 border-r border-gray-200 py-1">早</div>
                            <div className="flex-1 text-center font-semibold text-indigo-600 border-r border-gray-200 py-1">晚</div>
                            <div className="flex-1 text-center font-semibold text-orange-500 border-r border-gray-200 py-1">轮休</div>
                            <div className="flex-1 text-center font-semibold text-red-500 border-r border-gray-200 py-1">请假</div>
                            <div className="flex-1 text-center font-semibold text-green-600 py-1">法定</div>
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {scheduledMembersList.map((m, rowIdx) => {
                        const stat = personStats[rowIdx].counts;
                        const rowEven = rowIdx % 2 === 0;
                        return (
                          <tr key={m.name} className={rowEven ? 'bg-white' : 'bg-gray-50/40'}>
                            <td className={`sticky left-0 z-[20] border-r border-b px-4 py-2 font-bold whitespace-nowrap ${rowEven ? 'bg-white' : 'bg-gray-50'} text-gray-800`}>{m.name}</td>
                            {vTableDays.map(day => {
                              const dn = parseInt(format(day, 'd'));
                              const ymd = format(day, 'yyyy-MM-dd');
                              const shift = draft[m.name]?.[dn] ?? '';
                              const isPast = ymd <= today;
                              const cellBg = isPast ? 'bg-gray-100' : (getVDayBg(day) || 'bg-white');
                              const isOpen = viewingDropdown?.name === m.name && viewingDropdown?.day === dn;
                              return (
                                <td key={dn} className={`border-r border-b p-1 text-center relative ${cellBg}`}
                                  onClick={e => { e.stopPropagation(); setViewingDropdown(isOpen ? null : { name: m.name, day: dn }); }}>
                                  <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg border text-[11px] font-black cursor-pointer transition-all ${isOpen ? 'ring-2 ring-blue-400 ring-offset-1' : 'hover:ring-2 hover:ring-gray-300 hover:ring-offset-1'
                                    } ${isPast ? 'bg-gray-200 text-gray-400 border-gray-300' : shift ? (shiftStyle[shift] ?? 'bg-gray-50 text-gray-400 border-gray-200') : 'bg-gray-50 text-gray-300 border-dashed border-gray-200'
                                    }`}>{shift || '·'}</span>
                                  {isOpen && (
                                    <div className="absolute z-[500] top-full left-1/2 -translate-x-1/2 mt-0.5 bg-white border border-gray-200 rounded-xl shadow-xl p-1 flex flex-col gap-0.5 min-w-[44px]"
                                      onClick={e => e.stopPropagation()}>
                                      {(['早', '晚', '休', '假'] as const).map(opt => (
                                        <button key={opt} onClick={() => {
                                          setViewingDraft(prev => {
                                            if (!prev) return prev;
                                            return { ...prev, [m.name]: { ...prev[m.name], [dn]: opt } };
                                          });
                                          setViewingDropdown(null);
                                        }} className={`text-[11px] font-black px-2 py-1 rounded-lg transition-colors ${shift === opt ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100 text-gray-700'}`}>{opt}</button>
                                      ))}
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                            <td className={`sticky right-0 z-[20] border-l border-b ${rowEven ? 'bg-white' : 'bg-gray-50'}`} style={{ width: '220px', minWidth: '220px' }}>
                              <div className="flex h-full text-[10px]">
                                <div className={`flex-1 flex items-center justify-center border-r border-gray-200 py-2 font-black text-blue-700 ${rowEven ? 'bg-blue-50/60' : 'bg-blue-50'}`}>{stat['早']}<span className="text-[9px] font-normal text-gray-400 ml-0.5">天</span></div>
                                <div className={`flex-1 flex items-center justify-center border-r border-gray-200 py-2 font-black text-indigo-700 ${rowEven ? 'bg-indigo-50/60' : 'bg-indigo-50'}`}>{stat['晚']}<span className="text-[9px] font-normal text-gray-400 ml-0.5">天</span></div>
                                <div className={`flex-1 flex items-center justify-center border-r border-gray-200 py-2 font-black text-orange-500 ${rowEven ? 'bg-orange-50/60' : 'bg-orange-50'}`}>{stat['休']}<span className="text-[9px] font-normal text-gray-400 ml-0.5">天</span></div>
                                <div className={`flex-1 flex items-center justify-center border-r border-gray-200 py-2 font-black text-red-500 ${rowEven ? 'bg-red-50/40' : 'bg-red-50/60'}`}>{stat['假']}<span className="text-[9px] font-normal text-gray-400 ml-0.5">天</span></div>
                                <div className={`flex-1 flex items-center justify-center py-2 font-black text-green-600 ${rowEven ? 'bg-green-50/40' : 'bg-green-50/60'}`}>{stat['法定']}<span className="text-[9px] font-normal text-gray-400 ml-0.5">天</span></div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {viewingScheduleMode === 'table' && (
                <div className="px-6 py-4 border-t bg-white flex items-start gap-4 flex-wrap">
                  <div className="flex-1 flex flex-col gap-1 min-w-0 text-xs">
                    {rule1Bad.map(name => <span key={name} className="text-red-600 font-bold">⚠ {name} 存在连续上班 &gt;6 天的情况</span>)}
                    {rule2Bad.map(name => <span key={name} className="text-red-600 font-bold">⚠ {name} 存在晚班接早班的情况</span>)}
                    {rule5Bad.map(({ name, actual, required }) => <span key={name} className="text-red-600 font-bold">⚠ {name} 的排班天数不正确（实际 {actual} 天 / 应排班 {required} 天）</span>)}
                    {!hardFail && <span className="text-green-600 font-bold">✓ 所有硬规则均满足</span>}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <button onClick={() => setViewingSchedule(null)} className="px-5 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm font-bold hover:bg-gray-100 transition-all">取消</button>
                    <button
                      disabled={hardFail}
                      onClick={() => { if (!hardFail) setViewingConfirmSave(true); }}
                      className={`px-5 py-2 rounded-xl text-sm font-black text-white transition-all ${hardFail ? 'bg-gray-300 cursor-not-allowed opacity-60' : 'bg-green-500 hover:bg-green-600'}`}
                    >保存更改</button>
                  </div>
                </div>
              )}
            </div>
            {viewingConfirmSave && (
              <div className="fixed inset-0 z-[600] bg-black/60 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setViewingConfirmSave(false); }}>
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 flex flex-col gap-5">
                  <div className="text-base font-black text-gray-900">确认提交更改吗？</div>
                  <div className="text-sm text-gray-500 leading-relaxed">确认后将覆盖保存至原方案文件。</div>
                  <div className="flex gap-3 justify-end mt-2">
                    <button onClick={() => setViewingConfirmSave(false)} className="px-5 py-2 rounded-xl border border-gray-200 text-gray-600 font-bold text-sm hover:bg-gray-100 transition-all">取消</button>
                    <button onClick={async () => {
                      if (!viewingDraft) return;
                      try {
                        await paibanFetch('/api/paiban/saved-schedule/update', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ planId: viewingSchedule.id, schedule: viewingDraft }),
                        });
                      } catch (_) { /* 忽略网络错误 */ }
                      setSavedSchedules(prev => prev.map(s => s.id === viewingSchedule.id ? { ...s, schedule: viewingDraft } : s));
                      setViewingConfirmSave(false);
                      setViewingSchedule(null);
                    }} className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-sm transition-all">确认</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* 可用班次不足提醒弹窗 */}
      {showInsufficientModal && (
        <div className="fixed inset-0 z-[600] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm p-8 space-y-5">
            <h3 className="text-xl font-black text-gray-900">无法计算排班</h3>
            <p className="text-sm text-gray-500">可用班次不足，无法计算排班，请新增排班成员或降低最低排班人数要求</p>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowInsufficientModal(false)}
                className="px-6 py-2.5 rounded-xl bg-zinc-900 text-white text-sm font-bold hover:bg-black transition-all"
              >
                我知道了
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 删除方案确认弹窗 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[400] bg-black/60 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setShowDeleteConfirm(null); }}>
          <div className="bg-white rounded-[1.5rem] shadow-2xl w-full max-w-sm p-8 flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center mb-1">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" /></svg>
              </div>
              <div className="text-lg font-black text-gray-900">确认删除方案？</div>
              <div className="text-sm text-gray-500">该操作不可恢复，删除后方案数据将永久丢失。</div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(null)} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-all">取消</button>
              <button
                onClick={async () => {
                  if (!showDeleteConfirm) return;
                  try {
                    await paibanFetch('/api/paiban/saved-schedule/delete', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ planId: showDeleteConfirm }),
                    });
                  } catch (_) { /* 忽略网络错误 */ }
                  setSavedSchedules(prev => prev.filter(s => s.id !== showDeleteConfirm));
                  setShowDeleteConfirm(null);
                }}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 transition-all"
              >确认删除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
