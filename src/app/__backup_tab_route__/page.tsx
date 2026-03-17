'use client';

import React, { useEffect, useState } from 'react';
import {
  Users,
  Calendar as CalendarIcon,
  Settings,
  ChevronLeft,
  ChevronRight,
  Plus,
  Loader2,
  AlertCircle,
  Clock,
  Coffee,
  CalendarDays,
  RefreshCw,
  MoreVertical,
  Cpu,
  CheckCircle2,
  Activity,
  ArrowLeftRight,
  X,
  Trash2,
  Check
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
  endOfWeek
} from 'date-fns';
import { zhCN } from 'date-fns/locale';

type HolidayRow = { date: string; name: string; type: '节假日' | '调休上班日'; isLegal: boolean };

const DEFAULT_HOLIDAY_CONFIG: HolidayRow[] = [
  { date: '2026/02/14', name: '春节', type: '调休上班日', isLegal: false },
  { date: '2026/02/15', name: '春节', type: '节假日', isLegal: false },
  { date: '2026/02/16', name: '春节', type: '节假日', isLegal: true },
  { date: '2026/02/17', name: '春节', type: '节假日', isLegal: true },
  { date: '2026/02/18', name: '春节', type: '节假日', isLegal: true },
  { date: '2026/02/19', name: '春节', type: '节假日', isLegal: true },
  { date: '2026/02/20', name: '春节', type: '节假日', isLegal: false },
  { date: '2026/02/21', name: '春节', type: '节假日', isLegal: false },
  { date: '2026/02/22', name: '春节', type: '节假日', isLegal: false },
  { date: '2026/02/23', name: '春节', type: '节假日', isLegal: false },
  { date: '2026/02/28', name: '春节', type: '调休上班日', isLegal: false },
  { date: '2026/04/04', name: '清明节', type: '节假日', isLegal: false },
  { date: '2026/04/05', name: '清明节', type: '节假日', isLegal: true },
  { date: '2026/04/06', name: '清明节', type: '节假日', isLegal: false },
  { date: '2026/04/07', name: '清明节', type: '调休上班日', isLegal: false },
  { date: '2026/05/01', name: '劳动节', type: '节假日', isLegal: true },
  { date: '2026/05/02', name: '劳动节', type: '节假日', isLegal: true },
  { date: '2026/05/03', name: '劳动节', type: '节假日', isLegal: false },
  { date: '2026/05/04', name: '劳动节', type: '节假日', isLegal: false },
  { date: '2026/05/05', name: '劳动节', type: '节假日', isLegal: false },
  { date: '2026/05/09', name: '劳动节', type: '调休上班日', isLegal: false },
  { date: '2026/06/19', name: '端午节', type: '节假日', isLegal: true },
  { date: '2026/06/20', name: '端午节', type: '节假日', isLegal: false },
  { date: '2026/06/21', name: '端午节', type: '节假日', isLegal: false },
  { date: '2026/09/20', name: '中秋节', type: '调休上班日', isLegal: false },
  { date: '2026/09/25', name: '中秋节', type: '节假日', isLegal: true },
  { date: '2026/09/26', name: '中秋节', type: '节假日', isLegal: false },
  { date: '2026/09/27', name: '中秋节', type: '节假日', isLegal: false },
  { date: '2026/10/01', name: '国庆节', type: '节假日', isLegal: true },
  { date: '2026/10/02', name: '国庆节', type: '节假日', isLegal: true },
  { date: '2026/10/03', name: '国庆节', type: '节假日', isLegal: true },
  { date: '2026/10/04', name: '国庆节', type: '节假日', isLegal: false },
  { date: '2026/10/05', name: '国庆节', type: '节假日', isLegal: false },
  { date: '2026/10/06', name: '国庆节', type: '节假日', isLegal: false },
  { date: '2026/10/07', name: '国庆节', type: '节假日', isLegal: false },
];

const DEFAULT_MIN_STAFF: Record<string, number> = {
  '普通工作日': 2, '假前一日': 2, '周末': 1, '调休工作日': 1, '法定节假日': 1,
};

type MemberItem = { id: number; adminUserId: number; name: string; role: string; status: number; inSchedule: number };

type TabType = 'calendar' | 'my-schedule' | 'leave-request' | 'schedule-calc' | 'settings' | 'members';

// ========== paiban API 请求工具 ==========
// 从 sessionStorage 获取 satoken（由 work-admin 跳转时通过 URL 参数写入）
function getPaibanToken(): string {
  if (typeof window === 'undefined') return '';
  return sessionStorage.getItem('paiban_satoken') || '';
}

function paibanFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getPaibanToken();
  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      ...(token ? { satoken: token } : {}),
    },
  });
}
// ==========================================

import { useParams, useRouter, usePathname } from "next/navigation";

export default function Home() {
  const params = useParams();
  const router = useRouter();
  const tabParam = params?.tab?.[0];
  const activeTab: TabType = (tabParam as TabType) || 'calendar';
  const setActiveTab = (tab: TabType) => router.push(`/${tab}`);
  const [currentDate, setCurrentDate] = useState(new Date(2026, 2, 5));
  const nextMonthDate = addMonths(currentDate, 1);
  const [calendarViewMode, setCalendarViewMode] = useState<'current' | 'next'>('current');
  const [scheduleViewMode, setScheduleViewMode] = useState<'calendar' | 'table'>('calendar');
  // 成员列表（从后端获取）
  const [members, setMembers] = useState<MemberItem[]>([]);
  // 当前登录用户名（从后端获取）
  const [currentUser, setCurrentUser] = useState<string>('');
  const [onlyMe, setOnlyMe] = useState(false);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // 排班看板编辑模式
  const [boardEditMode, setBoardEditMode] = useState(false);
  const [boardEditDraft, setBoardEditDraft] = useState<Record<string, Record<number, '早' | '晚' | '休' | '假'>> | null>(null);
  const [boardEditDropdown, setBoardEditDropdown] = useState<{ name: string; day: number } | null>(null);
  const [boardEditConfirmSave, setBoardEditConfirmSave] = useState(false);

  // 排班调整日志
  type BoardEditLog = {
    id: string;
    month: string;
    editor: string;
    timestamp: string;
    type: 'edit' | 'apply_new' | 'apply_overwrite' | 'swap_request' | 'swap_approve' | 'swap_reject';
    // for 'edit'
    changes?: { name: string; day: number; fromShift: string; toShift: string }[];
    // for apply events
    planName?: string;
    // for swap events
    swapFrom?: string;
    swapTo?: string;
    swapPairs?: { fromDay: number; fromShift: string; toDay: number; toShift: string }[];
  };
  const [boardEditLogs, setBoardEditLogs] = useState<BoardEditLog[]>(() => {
    try { const s = localStorage.getItem('cs_board_edit_logs'); return s ? JSON.parse(s) : []; } catch { return []; }
  });
  const [boardLogOpen, setBoardLogOpen] = useState(true);

  // 请假数据：leaveData 为当前编辑草稿，submittedLeaveData 为已提交的各月意愿
  const [submittedLeaveData, setSubmittedLeaveData] = useState<Record<string, Record<string, '轮休' | '请假'>>>(() => {
    try {
      const stored = localStorage.getItem('cs_submitted_leaves');
      return stored ? JSON.parse(stored) : {};
    } catch { return {}; }
  });
  const [leaveData, setLeaveData] = useState<Record<string, '轮休' | '请假'>>(() => {
    // 初始化草稿：从已提交数据加载默认月份（fillMonth 初始为 addMonths(currentDate, 1)）
    try {
      const stored = localStorage.getItem('cs_submitted_leaves');
      const submitted = stored ? JSON.parse(stored) : {};
      const defaultYM = format(addMonths(new Date(2026, 2, 5), 1), 'yyyy-MM');
      return submitted[defaultYM] ?? {};
    } catch { return {}; }
  });
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 其他人的提交数据 (Phase 3 汇总)
  const otherTeamsLeaveData: Record<string, { name: string, type: string }[]> = {
  };

  const validateConsecutiveDays = () => {
    const nmStart = startOfMonth(fillMonth);
    const daysInMonth = parseInt(format(endOfMonth(nmStart), 'd'));

    let consecutiveWork = 0;
    for (let i = 1; i <= daysInMonth; i++) {
      const key = `${format(fillMonth, 'yyyy-MM')}-${i}`;
      const status = leaveData[key];

      // 注意：这里逻辑上认为没有预填 轮休/请假 的日期都是潜在的工作日
      if (!status) {
        consecutiveWork++;
      } else {
        consecutiveWork = 0;
      }

      if (consecutiveWork > 6) {
        return false;
      }
    }
    return true;
  };

  const handleSubmitWishes = () => {
    if (!validateConsecutiveDays()) {
      setErrorMessage("当前存在连上大于 6 天的情况，请重新调整");
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }
    // 将当前草稿中属于 fillMonth 的数据提交到 submittedLeaveData
    const fillMonthYM = format(fillMonth, 'yyyy-MM');
    const monthEntries: Record<string, '轮休' | '请假'> = {};
    Object.entries(leaveData).forEach(([k, v]) => {
      if (k.startsWith(fillMonthYM + '-')) monthEntries[k] = v;
    });
    setSubmittedLeaveData(prev => ({ ...prev, [fillMonthYM]: monthEntries }));
    alert(`${format(fillMonth, 'yyyy年MM月')} 意愿提交成功！`);
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

  // 预填统计：从 submittedLeaveData（已提交，当前用户）或 otherTeamsLeaveData（他人）取意愿天数
  const getSubmittedOffDays = (name: string, monthYM?: string): number => {
    if (name === currentUser) {
      const all = monthYM ? (submittedLeaveData[monthYM] ?? {}) : Object.values(submittedLeaveData).reduce((acc, m) => ({ ...acc, ...m }), {} as Record<string, string>);
      return Object.values(all).filter(v => v === '轮休').length;
    }
    const entries = monthYM
      ? Object.entries(otherTeamsLeaveData).filter(([k]) => k.startsWith(monthYM + '-')).flatMap(([, v]) => v)
      : Object.values(otherTeamsLeaveData).flat();
    return entries.filter(o => o.name === name && o.type === '轮休').length;
  };

  const getSubmittedLeaveDays = (name: string, monthYM?: string): number => {
    if (name === currentUser) {
      const all = monthYM ? (submittedLeaveData[monthYM] ?? {}) : Object.values(submittedLeaveData).reduce((acc, m) => ({ ...acc, ...m }), {} as Record<string, string>);
      return Object.values(all).filter(v => v === '请假').length;
    }
    const entries = monthYM
      ? Object.entries(otherTeamsLeaveData).filter(([k]) => k.startsWith(monthYM + '-')).flatMap(([, v]) => v)
      : Object.values(otherTeamsLeaveData).flat();
    return entries.filter(o => o.name === name && o.type === '请假').length;
  };

  // 当前用户是否已提交过指定月份的意愿
  const hasSubmittedForMonth = (monthYM: string): boolean => {
    return !!submittedLeaveData[monthYM] && Object.keys(submittedLeaveData[monthYM]).length > 0;
  };

  const fetchStats = async () => {
    setLoading(true);
    try {
      const resp = await fetch('/api/stats');
      const json = await resp.json();
      setData(json);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 读取 work-admin 跳转时传入的 satoken URL 参数，存入 sessionStorage
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('satoken');
    if (urlToken) {
      sessionStorage.setItem('paiban_satoken', urlToken);
      // 清除 URL 中的 token 参数（避免出现在浏览器历史记录中）
      window.history.replaceState({}, '', window.location.pathname);
    }

    fetchStats();
    fetch('/api/config/min-staff').then(r => r.json()).then(data => {
      setMinStaffConfig(data); setMinStaffDraft(data);
    }).catch(() => { });
    paibanFetch('/api/paiban/holiday/list').then(r => r.json()).then(res => {
      if (res.code === '0' && Array.isArray(res.data)) {
        const rows: HolidayRow[] = res.data.map((r: { date: string; name: string; type: number; isLegal: number }) => ({
          date: r.date.replace(/-/g, '/'),
          name: r.name,
          type: r.type === 2 ? '调休上班日' : '节假日',
          isLegal: r.isLegal === 1,
        }));
        setGlobalHolidayConfig(rows);
        setHolidayDraft(rows);
      }
    }).catch(() => { });
    // 从后端获取当前登录用户信息
    paibanFetch('/api/paiban/member/info').then(r => r.json()).then(res => {
      if (res.code === '0' && res.data) {
        setCurrentUser(res.data.name || '');
      }
    }).catch(() => { });
    // 从后端获取排班成员列表
    paibanFetch('/api/paiban/member/list').then(r => r.json()).then(res => {
      if (res.code === '0' && Array.isArray(res.data)) {
        setMembers(res.data);
      }
    }).catch(() => { });
  }, []);

  const calendarDisplayDate = calendarViewMode === 'next' ? nextMonthDate : currentDate;
  const monthStart = startOfMonth(calendarDisplayDate);
  const monthEnd = endOfMonth(monthStart);
  const calendarDays = eachDayOfInterval({
    start: startOfWeek(monthStart, { weekStartsOn: 1 }),
    end: endOfWeek(monthEnd, { weekStartsOn: 1 })
  });

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  // UI Mocks for specific views
  const renderCalendar = () => {
    const dispMonthPrefix = format(calendarDisplayDate, 'yyyy/MM');
    const dispMonthHolidayRows = globalHolidayConfig.filter(r => r.date.startsWith(dispMonthPrefix));
    const dispPublicHolidayDays = new Set(
      dispMonthHolidayRows.filter(r => r.type === '节假日').map(r => parseInt(r.date.split('/')[2]))
    );
    const dispMakeupWorkdays = new Set(
      dispMonthHolidayRows.filter(r => r.type === '调休上班日').map(r => parseInt(r.date.split('/')[2]))
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
      '工作日': '',
      '周末': 'bg-yellow-50',
      '节假日': 'bg-green-50',
      '调休日': 'bg-purple-50',
    };
    const dispDayTypeTag: Record<DispDayType, string> = {
      '工作日': '',
      '周末': 'text-yellow-600 bg-yellow-100 border-yellow-200',
      '节假日': 'text-green-700 bg-green-100 border-green-200',
      '调休日': 'text-purple-700 bg-purple-100 border-purple-200',
    };

    return (
      <div className="bg-white rounded-[2.5rem] border shadow-2xl overflow-hidden flex flex-col min-h-[850px]">
        {/* 深色表头 */}
        <div className="grid grid-cols-7 bg-zinc-900 border-b border-zinc-800">
          {['周一', '周二', '周三', '周四', '周五', '周六', '周日'].map(day => (
            <div key={day} className="py-5 text-center text-[11px] font-black text-zinc-500 uppercase tracking-[0.3em]">
              {day}
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
          <span className="flex items-center gap-1.5 ml-auto"><span className="w-3 h-3 rounded bg-orange-100 border border-orange-200 inline-block"></span> 我的休息日</span>
        </div>

        <div className="flex-1 grid grid-cols-7 border-collapse">
          {calendarDays.map((day, idx) => {
            const isCurrentMonth = format(day, 'MM') === format(calendarDisplayDate, 'MM');
            const isToday = isSameDay(day, new Date());
            const dayNum = parseInt(format(day, 'd'));
            const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
            const isPast = isCurrentMonth && day < todayStart && !isToday;
            const dayType = getDispDayType(day);

            // 获取当前登录用户在这个日期的班次
            const mySched = isCurrentMonth ? boardData.find(p => p.name === currentUser)?.schedules.find(s => s.day === dayNum) : null;
            const isMyOff = mySched?.shift === '休' || mySched?.shift === '假';

            return (
              <div
                key={idx}
                className={`relative min-h-[160px] border-r border-b border-gray-100 p-4 transition-all flex flex-col group/cell ${!isCurrentMonth ? 'bg-gray-50/50'
                  : isPast ? 'bg-gray-100'
                    : isMyOff ? (dispDayTypeBg[dayType] || 'bg-orange-50/30')
                      : (dispDayTypeBg[dayType] || 'bg-white')
                  }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex flex-col gap-1">
                    <span className={`text-lg font-black transition-colors ${isToday ? 'text-blue-600' : isPast ? 'text-gray-400' : isCurrentMonth ? 'text-gray-900' : 'text-gray-200'
                      }`}>
                      {format(day, 'd')}
                    </span>
                    {isCurrentMonth && !isPast && dayType !== '工作日' && (() => {
                      const dispHolRow = globalHolidayConfig.find(r => r.date === format(day, 'yyyy/MM/dd'));
                      const dispHolLabel = dispHolRow
                        ? (dispHolRow.isLegal ? `${dispHolRow.name}·法定节假日` : dispHolRow.name)
                        : dayType;
                      return (
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md border self-start ${dispDayTypeTag[dayType]}`}>
                          {dispHolLabel}
                        </span>
                      );
                    })()}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {isToday && (
                      <span className="bg-blue-600 text-white text-[9px] px-2 py-0.5 rounded-lg font-black tracking-widest">TODAY</span>
                    )}
                    {isCurrentMonth && !isPast && mySched && !isMyOff && (
                      <div className="flex items-center gap-1 bg-white/80 backdrop-blur-sm px-1.5 py-0.5 rounded-full border border-zinc-200 shadow-sm">
                        <span className={`w-1.5 h-1.5 rounded-full ${mySched.shift === '早' ? 'bg-blue-500' : 'bg-indigo-500'}`}></span>
                        <span className="text-[9px] font-black text-zinc-700">我: {mySched.shift}</span>
                      </div>
                    )}
                    {isCurrentMonth && !isPast && isMyOff && (
                      <div className="bg-orange-100 px-1.5 py-0.5 rounded-full border border-orange-200">
                        <span className="text-[9px] font-black text-orange-700">我: {mySched?.shift}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 左右分栏容器 */}
                {isCurrentMonth && (
                  <div className={`flex-1 grid grid-cols-2 gap-1 overflow-hidden min-h-0 ${isPast ? 'opacity-40' : ''}`}>
                    {/* 左栏：早班 */}
                    <div className="flex flex-col gap-0.5 border-r border-gray-100 pr-1 overflow-y-auto scrollbar-hide">
                      <div className="text-[9px] font-bold text-blue-500 mb-0.5 sticky top-0 bg-white/80 backdrop-blur-sm">早</div>
                      {(onlyMe ? boardData.filter(p => p.name === currentUser) : boardData)
                        .map(p => ({ name: p.name, s: p.schedules.find(s => s.day === dayNum) }))
                        .filter(i => i.s && i.s.shift === '早')
                        .map(i => (
                          <div key={i.name} className={`text-[9px] px-1 py-0.5 rounded border truncate shadow-sm transition-all ${i.name === currentUser
                            ? 'bg-blue-600 text-white border-blue-700 font-black scale-105 z-10'
                            : 'bg-blue-50 text-blue-700 border-blue-100'
                            }`}>
                            {i.name}
                          </div>
                        ))}
                    </div>
                    {/* 右栏：晚班 */}
                    <div className="flex flex-col gap-0.5 pl-1 overflow-y-auto scrollbar-hide">
                      <div className="text-[9px] font-bold text-indigo-500 mb-0.5 sticky top-0 bg-white/80 backdrop-blur-sm">晚</div>
                      {(onlyMe ? boardData.filter(p => p.name === currentUser) : boardData)
                        .map(p => ({ name: p.name, s: p.schedules.find(s => s.day === dayNum) }))
                        .filter(i => i.s && i.s.shift === '晚')
                        .map(i => (
                          <div key={i.name} className={`text-[9px] px-1 py-0.5 rounded border truncate shadow-sm transition-all ${i.name === currentUser
                            ? 'bg-indigo-600 text-white border-indigo-700 font-black scale-105 z-10'
                            : 'bg-indigo-50 text-indigo-700 border-indigo-100'
                            }`}>
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

    // 编辑模式下使用 draft 数据源
    const editing = boardEditMode && boardEditDraft !== null;
    const editDraft = boardEditDraft;

    // 编辑模式：从 draft 构造 displayData
    const editDisplayData = editing && editDraft
      ? Object.entries(editDraft).map(([name, days]) => ({
        name,
        schedules: Object.entries(days).map(([d, s]) => ({ day: parseInt(d), shift: s })),
      }))
      : [];

    const displayData = editing ? (onlyMe ? editDisplayData.filter(p => p.name === currentUser) : editDisplayData) : (onlyMe ? boardData.filter(p => p.name === currentUser) : boardData);

    const shiftStyle: Record<string, string> = {
      '早': 'bg-blue-100 text-blue-700 border-blue-200',
      '晚': 'bg-indigo-100 text-indigo-700 border-indigo-200',
      '休': 'bg-orange-50 text-orange-500 border-orange-200',
      '假': 'bg-gray-100 text-gray-400 border-gray-200',
    };

    // 法定节假日集合
    const tblMonthPrefix = format(calendarDisplayDate, 'yyyy/MM');
    const tblHols = globalHolidayConfig.filter(h => h.date.startsWith(tblMonthPrefix));
    const tblLegalHols = new Set(tblHols.filter(h => h.isLegal).map(h => {
      const parts = h.date.split('/');
      return parseInt(parts[2]);
    }));
    // 法定节假日 ymd 集合（用于校验）
    const tblLegalHolYmds = new Set(tblHols.filter(h => h.isLegal).map(h => {
      const parts = h.date.split('/');
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    }));
    // 公共假日 ymd 集合
    const tblPubHolYmds = new Set(tblHols.filter(h => h.type === '节假日').map(h => {
      const parts = h.date.split('/');
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    }));
    // 调休工作日 ymd 集合
    const tblMakeupYmds = new Set(tblHols.filter(h => h.type === '调休上班日').map(h => {
      const parts = h.date.split('/');
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    }));

    // 每人统计：早/晚/轮休/请假/法定排班天数
    const personStats = displayData.map(person => {
      const counts = { '早': 0, '晚': 0, '休': 0, '假': 0, '法定': 0 };
      person.schedules.forEach(s => {
        if (s.shift in counts) counts[s.shift as keyof typeof counts]++;
        if ((s.shift === '早' || s.shift === '晚') && tblLegalHols.has(s.day)) counts['法定']++;
      });
      return { name: person.name, counts };
    });

    // 每日统计：早/晚/休/假 人数 — 始终按全员统计，不受 onlyMe 影响
    const allData = editing ? editDisplayData : boardData;
    const dayStats = daysInMonth.map(day => {
      const d = parseInt(format(day, 'd'));
      const counts = { '早': 0, '晚': 0, '休': 0, '假': 0 };
      allData.forEach(person => {
        const shift = person.schedules.find(s => s.day === d)?.shift;
        if (shift === '早') counts['早']++;
        else if (shift === '晚') counts['晚']++;
        else if (shift === '休') counts['休']++;
        else if (shift === '假') counts['假']++;
      });
      return counts;
    });

    // ---- 编辑模式：实时校验 ----
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
      editMembers.forEach(m => {
        let consec = 0;
        for (const day of daysInMonth) {
          const dn = parseInt(format(day, 'd'));
          const s = editDraft[m.name]?.[dn];
          if (s === '早' || s === '晚') { consec++; if (consec > 6) { boardRule1Bad.push(m.name); break; } }
          else consec = 0;
        }
      });
      editMembers.forEach(m => {
        for (let i = 0; i < daysInMonth.length - 1; i++) {
          const d1 = parseInt(format(daysInMonth[i], 'd'));
          const d2 = parseInt(format(daysInMonth[i + 1], 'd'));
          if (editDraft[m.name]?.[d1] === '晚' && editDraft[m.name]?.[d2] === '早') { boardRule2Bad.push(m.name); break; }
        }
      });
      daysInMonth.forEach(day => {
        const dn = parseInt(format(day, 'd'));
        let early = 0, late = 0;
        editMembers.forEach(m => { const s = editDraft[m.name]?.[dn]; if (s === '早') early++; if (s === '晚') late++; });
        const diff = late - early;
        if (diff !== 0 && diff !== 1) boardRule3BadDays.push(format(day, 'M/d'));
      });
      daysInMonth.forEach(day => {
        const dn = parseInt(format(day, 'd'));
        const ymd = format(day, 'yyyy-MM-dd');
        const minStaff = calcDayMinStaffOverrides[ymd] ?? (minStaffConfig[getBoardDayTypeKey(day)] ?? 1);
        let early = 0, late = 0;
        editMembers.forEach(m => { const s = editDraft[m.name]?.[dn]; if (s === '早') early++; if (s === '晚') late++; });
        if (early + late < minStaff) boardRule4BadDays.push(format(day, 'M/d'));
      });
      // rule5：每人排班天数必须严格等于应排班天数
      const bNormalWorkDayCount = daysInMonth.filter(d => {
        const t = getBoardDayTypeKey(d);
        return t === '普通工作日' || t === '假前一日' || t === '调休工作日';
      }).length;
      const bLegalHolidayCount = tblHols.filter(h => h.isLegal).length;
      editMembers.forEach(m => {
        const legalWork = memberHolidayDays[m.name] ?? bLegalHolidayCount;
        const leaveCnt = daysInMonth.filter(d => editDraft[m.name]?.[parseInt(format(d, 'd'))] === '假').length;
        const requiredWorkDays = bNormalWorkDayCount + legalWork - leaveCnt;
        const actualWorkDays = daysInMonth.filter(d => { const s = editDraft[m.name]?.[parseInt(format(d, 'd'))]; return s === '早' || s === '晚'; }).length;
        if (actualWorkDays !== requiredWorkDays) boardRule5Bad.push({ name: m.name, actual: actualWorkDays, required: requiredWorkDays });
      });
      boardHardFail = boardRule1Bad.length > 0 || boardRule2Bad.length > 0 || boardRule5Bad.length > 0;
      boardSoftWarn = boardRule3BadDays.length > 0 || boardRule4BadDays.length > 0;
    }

    return (
      <div className="bg-white rounded-2xl shadow-sm border overflow-hidden" onClick={() => editing && setBoardEditDropdown(null)}>
        {editing && (
          <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 flex items-center gap-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
            <span className="text-sm font-bold text-amber-700">编辑模式 · 点击单元格可修改排班</span>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="sticky left-0 z-20 bg-gray-50 border-r px-4 py-3 text-left font-semibold text-gray-500 min-w-[80px]">成员</th>
                {daysInMonth.map(day => {
                  const isToday = isSameDay(day, new Date());
                  const dow = getDay(day);
                  const isWeekend = dow === 0 || dow === 6;
                  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
                  const isPast = day < todayStart && !isToday;
                  return (
                    <th
                      key={format(day, 'd')}
                      className={`px-1 py-2 text-center font-semibold min-w-[36px] border-r ${isToday ? 'bg-blue-600 text-white'
                        : isPast ? 'bg-gray-100 text-gray-400'
                          : isWeekend ? 'text-yellow-600 bg-yellow-50'
                            : 'text-gray-500'
                        }`}
                    >
                      <div>{format(day, 'd')}</div>
                      <div className="text-[9px] font-normal opacity-70">{format(day, 'EEE', { locale: zhCN })}</div>
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
                    <td className={`sticky left-0 z-10 border-r border-b px-4 py-2 font-bold whitespace-nowrap ${rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                      } ${person.name === currentUser ? 'text-blue-600' : 'text-gray-800'}`}>
                      {person.name}
                      {person.name === currentUser && <span className="ml-1 text-[9px] text-blue-400">(我)</span>}
                    </td>
                    {daysInMonth.map(day => {
                      const d = parseInt(format(day, 'd'));
                      const sched = person.schedules.find(s => s.day === d);
                      const shift = sched?.shift ?? '';
                      const isToday = isSameDay(day, new Date());
                      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
                      const isPast = day < todayStart && !isToday;
                      const isDropOpen = editing && boardEditDropdown?.name === person.name && boardEditDropdown?.day === d;
                      return (
                        <td
                          key={d}
                          className={`border-r border-b p-1 text-center relative ${isPast ? 'bg-gray-100' : isToday ? 'bg-blue-50' : ''
                            }`}
                          onClick={e => { if (editing) { e.stopPropagation(); setBoardEditDropdown(isDropOpen ? null : { name: person.name, day: d }); } }}
                        >
                          <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg border text-[11px] font-black ${editing ? (
                            isDropOpen ? 'ring-2 ring-blue-400 ring-offset-1 cursor-pointer' : 'hover:ring-2 hover:ring-gray-300 hover:ring-offset-1 cursor-pointer'
                          ) : ''
                            } ${shift ? (
                              isPast
                                ? 'bg-gray-200 text-gray-400 border-gray-300'
                                : person.name === currentUser && !editing
                                  ? shift === '早' ? 'bg-blue-600 text-white border-blue-700'
                                    : shift === '晚' ? 'bg-indigo-600 text-white border-indigo-700'
                                      : 'bg-orange-200 text-orange-700 border-orange-300'
                                  : shiftStyle[shift] ?? 'bg-gray-50 text-gray-400 border-gray-200'
                            ) : 'bg-gray-50 text-gray-300 border-dashed border-gray-200'
                            }`}>{shift || '·'}</span>
                          {isDropOpen && (
                            <div className="absolute z-[500] top-full left-1/2 -translate-x-1/2 mt-0.5 bg-white border border-gray-200 rounded-xl shadow-xl p-1 flex flex-col gap-0.5 min-w-[44px]"
                              onClick={e => e.stopPropagation()}>
                              {(['早', '晚', '休', '假'] as const).map(opt => (
                                <button key={opt} onClick={() => {
                                  setBoardEditDraft(prev => {
                                    if (!prev) return prev;
                                    return { ...prev, [person.name]: { ...prev[person.name], [d]: opt } };
                                  });
                                  setBoardEditDropdown(null);
                                }} className={`text-[11px] font-black px-2 py-1 rounded-lg transition-colors ${shift === opt ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100 text-gray-700'
                                  }`}>{opt}</button>
                              ))}
                            </div>
                          )}
                        </td>
                      );
                    })}
                    {/* 右侧每人统计列：早/晚/轮休/请假/法定 各一格，分列sticky */}
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
            {/* 底部每日统计 */}
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
                    <td className={`sticky left-0 z-10 bg-gray-100 border-r border-b px-4 py-2 font-bold whitespace-nowrap`}>
                      <span className={`inline-block text-[10px] font-black border rounded px-2 py-0.5 ${labelCls}`}>{label}</span>
                    </td>
                    {dayStats.map((ds, di) => {
                      const count = ds[dayKey];
                      const isToday = isSameDay(daysInMonth[di], new Date());
                      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
                      const isPast = daysInMonth[di] < todayStart && !isToday;
                      return (
                        <td key={di} className={`border-r border-b p-1 text-center ${isPast ? 'bg-gray-100' : isToday ? 'bg-blue-50' : ''
                          }`}>
                          <span className={`text-[11px] font-black ${isPast ? 'text-gray-400' : numCls}`}>{count > 0 ? count : <span className="text-gray-300">0</span>}</span>
                        </td>
                      );
                    })}
                    {/* 右侧合计：5列，只高亮对应列 */}
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
                    <td className="sticky right-0 z-10 border-l border-b px-2 py-2 text-center bg-gray-100">
                    </td>
                  </tr>
                );
              })}
            </tfoot>
          </table>
        </div>
        {/* 编辑模式：校验信息 + 保存/取消 */}
        {editing && (
          <div className="px-6 py-4 border-t bg-white flex items-start gap-4 flex-wrap">
            <div className="flex-1 flex flex-col gap-1 min-w-0 text-xs">
              {boardRule1Bad.map(name => (
                <span key={name} className="text-red-600 font-bold">⚠ {name} 存在连续上班 &gt;6 天的情况</span>
              ))}
              {boardRule2Bad.map(name => (
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
              <button onClick={() => { setBoardEditMode(false); setBoardEditDraft(null); setBoardEditDropdown(null); }} className="px-5 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm font-bold hover:bg-gray-100 transition-all">取消</button>
              <button
                disabled={boardHardFail}
                onClick={() => { if (!boardHardFail) setBoardEditConfirmSave(true); }}
                className={`px-5 py-2 rounded-xl text-sm font-black text-white transition-all ${boardHardFail ? 'bg-gray-300 cursor-not-allowed opacity-60' : boardSoftWarn ? 'bg-yellow-400 hover:bg-yellow-500' : 'bg-green-500 hover:bg-green-600'
                  }`}
              >保存更改</button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const [initLoading, setInitLoading] = useState(false);
  const [initSuccess, setInitSuccess] = useState(false);
  const [calcLoading, setCalcLoading] = useState(false);
  const [calcDone, setCalcDone] = useState(false);
  const [calcMonth, setCalcMonth] = useState(() => addMonths(new Date(2026, 2, 5), 1));
  const [editingMinStaff, setEditingMinStaff] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState(false);
  const [editingCalcHoliday, setEditingCalcHoliday] = useState(false);
  const [editingCalcCalendar, setEditingCalcCalendar] = useState(false);
  const [prefillOpenMap, setPrefillOpenMap] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem('cs_prefill_open') || '{}'); } catch { return {}; }
  });
  const [fillMonth, setFillMonth] = useState(() => addMonths(currentDate, 1));
  const [calcDayTypeOverrides, setCalcDayTypeOverrides] = useState<Record<string, '工作日' | '周末' | '法定节假日' | '调休工作日'>>({});
  // 每日最低排班人数覆盖（key = yyyy-MM-dd，value = 人数）；未设置时回退到全局配置
  const [calcDayMinStaffOverrides, setCalcDayMinStaffOverrides] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem('cs_day_min_staff_overrides') || '{}'); } catch { return {}; }
  });
  // 编辑日历时的临时草稿（用于取消恢复）
  const [calcDayTypeOverridesDraft, setCalcDayTypeOverridesDraft] = useState<Record<string, '工作日' | '周末' | '法定节假日' | '调休工作日'>>({});
  const [calcDayMinStaffOverridesDraft, setCalcDayMinStaffOverridesDraft] = useState<Record<string, number>>({});
  const [memberHolidayDays, setMemberHolidayDays] = useState<Record<string, number>>({});
  // Global configs (loaded from API, shared across views)
  const [globalHolidayConfig, setGlobalHolidayConfig] = useState<HolidayRow[]>(DEFAULT_HOLIDAY_CONFIG);
  const [holidayDraft, setHolidayDraft] = useState<HolidayRow[]>(DEFAULT_HOLIDAY_CONFIG);
  const [minStaffConfig, setMinStaffConfig] = useState<Record<string, number>>(DEFAULT_MIN_STAFF);
  const [minStaffDraft, setMinStaffDraft] = useState<Record<string, number>>(DEFAULT_MIN_STAFF);

  // 排班计算弹窗相关
  const [showCalcModal, setShowCalcModal] = useState(false);
  const [calcLogs, setCalcLogs] = useState<string[]>([]);
  const [calcScheduleResult, setCalcScheduleResult] = useState<Record<string, Record<number, '早' | '晚' | '休' | '假'>> | null>(null);
  const [calcRunning, setCalcRunning] = useState(false);

  // 成员列表（与后端 cs_schedule_member 同步）
  type LocalMember = { id: number; name: string; role: string; status: string; inSchedule: boolean };
  const [membersList, setMembersList] = useState<LocalMember[]>([]);

  // 当 members（后端）加载完成后同步到 membersList
  useEffect(() => {
    if (members.length > 0) {
      const validRoles = ['租号客服', '卖号客服', '管理员'];
      setMembersList(members.map(m => ({
        id: m.id,
        name: m.name,
        role: validRoles.includes(m.role) ? m.role : '租号客服',
        status: m.status === 1 ? '在职' : '离职',
        inSchedule: m.inSchedule === 1,
      })));
    }
  }, [members]);

  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [addMemberName, setAddMemberName] = useState('');
  const [addMemberRole, setAddMemberRole] = useState<'租号客服' | '卖号客服' | '管理员'>('租号客服');
  // 修改成员弹窗
  const [showEditMemberModal, setShowEditMemberModal] = useState(false);
  const [editMemberIdx, setEditMemberIdx] = useState<number | null>(null);
  const [editMemberName, setEditMemberName] = useState('');
  const [editMemberRole, setEditMemberRole] = useState<'租号客服' | '卖号客服' | '管理员'>('租号客服');
  // 节假日批量导入
  const [showHolidayImportModal, setShowHolidayImportModal] = useState(false);
  const [holidayImportText, setHolidayImportText] = useState('');
  const [holidayImportPreview, setHolidayImportPreview] = useState<HolidayRow[] | null>(null);

  // 已保存排班方案（持久化到 localStorage）
  type SavedSchedule = { id: string; planName: string; month: string; schedule: Record<string, Record<number, '早' | '晚' | '休' | '假'>> };
  const [savedSchedules, setSavedSchedules] = useState<SavedSchedule[]>(() => {
    try {
      const stored = localStorage.getItem('cs_saved_schedules');
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });
  const [showSaveNameModal, setShowSaveNameModal] = useState(false);
  const [savePlanName, setSavePlanName] = useState('');
  const [viewingSchedule, setViewingSchedule] = useState<SavedSchedule | null>(null);
  const [viewingScheduleMode, setViewingScheduleMode] = useState<'calendar' | 'table'>('calendar');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [viewingDraft, setViewingDraft] = useState<Record<string, Record<number, '早' | '晚' | '休' | '假'>> | null>(null);
  const [viewingDropdown, setViewingDropdown] = useState<{ name: string; day: number } | null>(null);
  const [viewingConfirmSave, setViewingConfirmSave] = useState(false);

  // 应用方案 — 已应用的排班（按月份 yyyy-MM 为 key 存储）
  const [appliedSchedules, setAppliedSchedules] = useState<Record<string, SavedSchedule>>(() => {
    try {
      const stored = localStorage.getItem('cs_applied_schedules');
      return stored ? JSON.parse(stored) : {};
    } catch { return {}; }
  });

  // 从后端 cs_schedule_detail 拉取的排班明细（按月份缓存）
  const [dbBoardData, setDbBoardData] = useState<{ name: string; schedules: { day: number; shift: string }[] }[] | null>(null);
  const [showApplyOverwriteConfirm, setShowApplyOverwriteConfirm] = useState<SavedSchedule | null>(null);
  const [showApplySuccess, setShowApplySuccess] = useState<SavedSchedule | null>(null);

  // ========== 对调功能 ==========
  type SwapPair = { fromDay: number; fromShift: '早' | '晚' | '休' | '假'; toDay: number; toShift: '早' | '晚' | '休' | '假' };
  type SwapRequest = {
    id: string;
    fromUser: string;
    toUser: string;
    month: string; // yyyy-MM
    swaps: SwapPair[];
    status: '待处理' | '已同意' | '已拒绝';
    createdAt: string;
  };
  const [swapRequests, setSwapRequests] = useState<SwapRequest[]>(() => {
    try {
      // v2: 清除旧格式对调数据
      if (!localStorage.getItem('cs_swap_v2')) {
        localStorage.removeItem('cs_swap_requests');
        localStorage.setItem('cs_swap_v2', '1');
        return [];
      }
      const stored = localStorage.getItem('cs_swap_requests');
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [swapTargetUser, setSwapTargetUser] = useState('');
  const [swapSelectedDays, setSwapSelectedDays] = useState<string[]>(['']);
  const [swapError, setSwapError] = useState<string | null>(null);
  const [swapValidationResult, setSwapValidationResult] = useState<string | null>(null);
  const [showSwapDetail, setShowSwapDetail] = useState<SwapRequest | null>(null);

  useEffect(() => { localStorage.setItem('cs_swap_requests', JSON.stringify(swapRequests)); }, [swapRequests]);
  useEffect(() => { localStorage.setItem('cs_saved_schedules', JSON.stringify(savedSchedules)); }, [savedSchedules]);
  useEffect(() => { localStorage.setItem('cs_applied_schedules', JSON.stringify(appliedSchedules)); }, [appliedSchedules]);
  useEffect(() => { localStorage.setItem('cs_prefill_open', JSON.stringify(prefillOpenMap)); }, [prefillOpenMap]);
  useEffect(() => { localStorage.setItem('cs_day_min_staff_overrides', JSON.stringify(calcDayMinStaffOverrides)); }, [calcDayMinStaffOverrides]);
  useEffect(() => { localStorage.setItem('cs_submitted_leaves', JSON.stringify(submittedLeaveData)); }, [submittedLeaveData]);
  useEffect(() => { localStorage.setItem('cs_board_edit_logs', JSON.stringify(boardEditLogs)); }, [boardEditLogs]);

  // 应用方案：直接应用 or 覆盖确认
  const handleApply = (plan: SavedSchedule) => {
    if (appliedSchedules[plan.month]) {
      setShowApplyOverwriteConfirm(plan);
    } else {
      setAppliedSchedules(prev => ({ ...prev, [plan.month]: plan }));
      setBoardEditLogs(prev => [{ id: Date.now().toString(), month: plan.month, editor: currentUser, timestamp: new Date().toISOString(), type: 'apply_new' as const, planName: plan.planName }, ...prev]);
      setShowApplySuccess(plan);
    }
  };
  const doApply = (plan: SavedSchedule) => {
    setAppliedSchedules(prev => ({ ...prev, [plan.month]: plan }));
    setBoardEditLogs(prev => [{ id: Date.now().toString(), month: plan.month, editor: currentUser, timestamp: new Date().toISOString(), type: 'apply_overwrite' as const, planName: plan.planName }, ...prev]);
    setShowApplyOverwriteConfirm(null);
    setShowApplySuccess(plan);
  };
  const navigateToBoardMonth = (plan: SavedSchedule) => {
    const [year, month] = plan.month.split('-').map(Number);
    const planDate = new Date(year, month - 1, 1);
    const currentYM = format(currentDate, 'yyyy-MM');
    if (plan.month === currentYM) {
      setCalendarViewMode('current');
    } else {
      setCurrentDate(addMonths(planDate, -1));
      setCalendarViewMode('next');
    }
    setShowApplySuccess(null);
    setActiveTab('calendar');
  };

  // 排班看板数据：优先使用后端 cs_schedule_detail，无数据则回退到本地已应用方案
  const boardMonthKey = format(calendarDisplayDate, 'yyyy-MM');
  const boardApplied = appliedSchedules[boardMonthKey] ?? null;

  // 切换月份时清空 DB 明细缓存并重新拉取，同时退出排班编辑模式
  useEffect(() => {
    setBoardEditMode(false); setBoardEditDraft(null); setBoardEditDropdown(null);
    setDbBoardData(null);
    paibanFetch(`/api/paiban/schedule/detail?month=${boardMonthKey}`)
      .then(r => r.json())
      .then(res => {
        if (res.code === '0' && Array.isArray(res.data) && res.data.length > 0) {
          const grouped: Record<string, { day: number; shift: string }[]> = {};
          (res.data as { name: string; day: number; shift: string }[]).forEach(r => {
            if (!grouped[r.name]) grouped[r.name] = [];
            grouped[r.name].push({ day: r.day, shift: r.shift });
          });
          setDbBoardData(Object.entries(grouped).map(([name, schedules]) => ({ name, schedules })));
        }
      })
      .catch(() => {});
  }, [boardMonthKey]);

  // 当前用户在看板所选月份是否有排班
  const currentUserHasSchedule = dbBoardData && dbBoardData.length > 0
    ? !!(dbBoardData.find(p => p.name === currentUser)?.schedules.length)
    : !!(boardApplied?.schedule[currentUser] && Object.keys(boardApplied.schedule[currentUser]).length > 0);
  // 当前用户是否为管理员（成员管理中的岗位）
  const isAdmin = membersList.find(m => m.name === currentUser)?.role === '管理员';
  const boardData: { name: string; schedules: { day: number; shift: string }[] }[] = dbBoardData && dbBoardData.length > 0
    ? dbBoardData
    : boardApplied
      ? Object.entries(boardApplied.schedule).map(([name, days]) => ({
        name,
        schedules: Object.entries(days).map(([d, s]) => ({ day: parseInt(d), shift: s })),
      }))
      : [];

  useEffect(() => {
    if (viewingSchedule) {
      const copy: Record<string, Record<number, '早' | '晚' | '休' | '假'>> = {};
      for (const [k, v] of Object.entries(viewingSchedule.schedule)) copy[k] = { ...v };
      setViewingDraft(copy);
    } else {
      setViewingDraft(null);
    }
    setViewingDropdown(null);
    setViewingConfirmSave(false);
  }, [viewingSchedule?.id]);

  const handleInit = async () => {
    setInitLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    setInitLoading(false);
    setInitSuccess(true);
    setTimeout(() => setInitSuccess(false), 3000);
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

    // 派生当月节假日配置
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
    Object.entries(otherTeamsLeaveData).forEach(([key, ents]) => {
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

  // 带自动重试的计算入口（最多 MAX_RETRY 次）
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
  // ========================================

  const renderLeaveRequestView = () => {
    const nmStart = startOfMonth(fillMonth);
    const nmEnd = endOfMonth(nmStart);
    const nmCalendarDays = eachDayOfInterval({
      start: startOfWeek(nmStart, { weekStartsOn: 1 }),
      end: endOfWeek(nmEnd, { weekStartsOn: 1 })
    });

    const fillMonthYM = format(fillMonth, 'yyyy-MM');
    const usedOffDays = Object.entries(leaveData).filter(([k, v]) => k.startsWith(fillMonthYM + '-') && v === '轮休').length;
    const usedLeaveDays = Object.entries(leaveData).filter(([k, v]) => k.startsWith(fillMonthYM + '-') && v === '请假').length;

    // 下月日期类型定义
    const nmYear = parseInt(format(fillMonth, 'yyyy'));
    const nmMonth = parseInt(format(fillMonth, 'MM'));
    // 从全局配置派生当月节假日 / 调休上班日
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
    // 动态计算轮休额度 = 当月天数 - 工作日 - 调休工作日 - 法定加班日
    const nmAllDays = eachDayOfInterval({ start: nmStart, end: nmEnd });
    const nmLegalHolidayCount = nmMonthHolidays.filter(h => h.isLegal).length;
    const nmRegularWorkdays = nmAllDays.filter(d => getDayType(d) === '工作日').length;
    const nmLegalOvertimeCount = memberHolidayDays[currentUser] ?? nmLegalHolidayCount;
    const totalOffDays = nmAllDays.length - nmRegularWorkdays - makeupWorkNums.size - nmLegalOvertimeCount;
    // 可填写数量 = 客服总人数 - 对应日期类型最低排班人数（来自全局配置）
    const dayTypeToMinStaffKey: Record<DayType, string> = {
      '工作日': '普通工作日', '周末': '周末', '节假日': '法定节假日', '调休日': '调休工作日',
    };
    const getMaxRest = (dt: DayType): number =>
      Math.max(0, membersList.filter(m => m.inSchedule).length - (minStaffConfig[dayTypeToMinStaffKey[dt]] ?? 0));
    // 统计每天已设轮休人数（自己 + 他人）
    const getUsedRestCount = (dNum: number): number => {
      const key = `${format(fillMonth, 'yyyy-MM')}-${dNum}`;
      const othersCount = (otherTeamsLeaveData[key] || []).filter(o => o.type === '轮休').length;
      const selfCount = leaveData[key] === '轮休' ? 1 : 0;
      return othersCount + selfCount;
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

    // 开放预填状态
    const fillPrevDay20 = addDays(startOfMonth(subMonths(fillMonth, 1)), 19);
    const isFillPrefillOpen = prefillOpenMap[fillMonthYM] !== undefined
      ? prefillOpenMap[fillMonthYM]
      : (currentDate.getTime() >= fillPrevDay20.getTime());
    const currentUserMember = membersList.find(m => m.name === currentUser);
    const isCurrentUserScheduled = !!(currentUserMember?.inSchedule);

    // 月份下拉选项：基于当天日期，往后3个月为可选月份
    const fillMonthOptions = [1, 2, 3].map(n => addMonths(new Date(), n));

    return (
      <div className="max-w-[1600px] mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 relative">
        {/* Toast 提醒 */}
        {errorMessage && (
          <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] bg-red-600 text-white px-8 py-4 rounded-2xl shadow-2xl font-black flex items-center gap-3 animate-in slide-in-from-top-4 border-2 border-white/20 backdrop-blur-md">
            <AlertCircle size={24} /> {errorMessage}
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
                  // 加载该月份已提交的意愿作为草稿
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
              const others = isCurr ? (otherTeamsLeaveData[key] || []) : [];
              const isSelected = selectedDay === dNum && isCurr;
              const dayType = isCurr ? getDayType(day) : '工作日';
              const maxRest = getMaxRest(dayType);
              const usedRest = isCurr ? getUsedRestCount(dNum) : 0;
              const restRemaining = maxRest - usedRest;

              return (
                <div
                  key={idx}
                  onClick={() => isCurr && setSelectedDay(isSelected ? null : dNum)}
                  className={`relative min-h-[160px] border-r border-b border-gray-100 p-4 transition-all cursor-pointer flex flex-col group/cell ${!isCurr ? 'bg-gray-50/50' : isSelected ? '' : dayTypeBg[dayType]
                    } ${isSelected ? 'ring-4 ring-blue-500/20 ring-inset z-10 bg-blue-50/40' : ''}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex flex-col gap-1">
                      <span className={`text-lg font-black transition-colors ${!isCurr ? 'text-gray-200' : isSelected ? 'text-blue-600' : 'text-gray-900'
                        }`}>
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
                        <div className={`text-[9px] font-black px-2 py-0.5 rounded-lg border ${restRemaining < 0
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
                    {/* 我的预填 */}
                    {mySelection && (
                      <div>
                        <div className={`px-3 py-2.5 rounded-2xl text-[11px] font-black border-2 transition-all shadow-sm ${mySelection === '轮休'
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

                    {/* 他人的预填 */}
                    {others.map((o, i) => (
                      <div key={i} className={`px-3 py-2 rounded-xl text-[10px] font-bold border transition-all ${o.type === '轮休'
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
                          className={`flex-1 py-3 text-white text-[11px] font-black rounded-2xl shadow-lg active:scale-95 transition-all ${usedOffDays >= totalOffDays && mySelection !== '轮休'
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
  };

  const renderScheduleCalcView = () => {
    const calcMonthYMForWishes = format(calcMonth, 'yyyy-MM');
    // 模拟各成员已填写的意愿数据 (Phase 3 汇总)
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
    const handleCalc = async () => {
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

    // 月份下拉选项：基于当天日期，前2个月 + 当月 + 后3个月
    const refDate = startOfMonth(new Date());
    const monthOptions = [-2, -1, 0, 1, 2, 3].map(offset => addMonths(refDate, offset));
    const calcMonthYMStr = format(calcMonth, 'yyyy-MM');
    const firstMonthYM = format(monthOptions[0], 'yyyy-MM');
    const lastMonthYM = format(monthOptions[monthOptions.length - 1], 'yyyy-MM');
    const isAtMinMonth = calcMonthYMStr === firstMonthYM;
    const isAtMaxMonth = calcMonthYMStr === lastMonthYM;

    // 从全局配置派生当月节假日数据
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

    // 获取某天的基础类型（不含假前一日自动推导）
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

    // 获取某天最终展示类型（含假前一日自动推导，仅工作日可被推导为假前一日）
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

    // 日历数据
    const monthStart = startOfMonth(calcMonth);
    const monthEnd = endOfMonth(calcMonth);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const startDow = getDay(monthStart); // 0=Sun，空白格数量

    // 按日历实际类型计算各人本月轮休额度
    const calcMonthTotalDays = days.length;
    const calcWorkdayCount = days.filter(d => { const t = getFinalType(d).type; return t === '工作日' || t === '假前一日'; }).length;
    const calcMakeupWorkdayCount = days.filter(d => getFinalType(d).type === '调休工作日').length;
    const getMonthlyQuota = (memberName: string) =>
      Math.max(0, calcMonthTotalDays - calcWorkdayCount - calcMakeupWorkdayCount - (memberHolidayDays[memberName] ?? legalHolidayCount));

    // 颜色映射
    const typeBg: Record<string, string> = {
      '工作日': 'bg-white',
      '假前一日': 'bg-orange-50',
      '周末': 'bg-yellow-50',
      '法定节假日': 'bg-green-50',
      '调休工作日': 'bg-purple-50',
    };
    const typeText: Record<string, string> = {
      '工作日': 'text-gray-700',
      '假前一日': 'text-orange-500',
      '周末': 'text-yellow-600',
      '法定节假日': 'text-green-600',
      '调休工作日': 'text-purple-600',
    };
    const typeDot: Record<string, string> = {
      '工作日': 'bg-gray-300',
      '假前一日': 'bg-orange-400',
      '周末': 'bg-yellow-400',
      '法定节假日': 'bg-green-500',
      '调休工作日': 'bg-purple-500',
    };

    // 排班进度计算
    const progressMonthYM = format(calcMonth, 'yyyy-MM');
    const prevMonthStart = startOfMonth(subMonths(calcMonth, 1));
    const day18OfPrev = addDays(prevMonthStart, 17);
    const day20OfPrev = addDays(prevMonthStart, 19);
    const day22OfPrev = addDays(prevMonthStart, 21);
    const hasSubmittedWishes = submittedCount > 0;
    const hasSavedPlan = savedSchedules.some(s => s.month === progressMonthYM);
    const hasPublishedPlan = !!appliedSchedules[progressMonthYM];
    const todayTs = currentDate.getTime();
    const effectivePrefillOpen = prefillOpenMap[progressMonthYM] !== undefined
      ? prefillOpenMap[progressMonthYM]
      : (todayTs >= day20OfPrev.getTime());
    const node2Status: 'done' | 'progress' | 'todo' =
      (hasSubmittedWishes && hasSavedPlan) ? 'done' :
        hasSubmittedWishes ? 'progress' :
          todayTs >= day22OfPrev.getTime() ? 'done' :
            todayTs >= day20OfPrev.getTime() ? 'progress' : 'todo';
    const node1Status: 'done' | 'progress' | 'todo' =
      (node2Status === 'done' || node2Status === 'progress') ? 'done' :
        todayTs >= day20OfPrev.getTime() ? 'done' :
          (todayTs >= day18OfPrev.getTime() || hasSubmittedWishes) ? 'progress' : 'todo';
    const node3Status: 'done' | 'progress' | 'todo' =
      hasPublishedPlan ? 'done' :
        hasSavedPlan ? 'progress' : 'todo';

    return (
      <div className="max-w-[1200px] mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4">

        {/* ① 筛选行：左对齐，上一月 / 下拉 / 下一月 */}
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

        {/* ② 页头统计 */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
              <span className="bg-zinc-900 text-white p-2 rounded-2xl"><Cpu size={24} /></span>
              排班计算
            </h1>
            <p className="text-sm text-gray-400 mt-1 font-medium">
              基于成员预填意愿，一键生成下月排班草案
            </p>
          </div>
          <div className="flex items-center gap-3 text-sm font-bold">
            <span className="text-gray-400">已提交：</span>
            <span className={`text-2xl font-black ${submittedCount === totalMembers ? 'text-green-600' : 'text-orange-500'}`}>{submittedCount}</span>
            <span className="text-gray-300">/</span>
            <span className="text-2xl font-black text-gray-900">{totalMembers}</span>
            <span className="text-gray-400">人</span>
          </div>
        </div>

        {/* ②-b X月排班进度 */}
        <div className="bg-white rounded-[2rem] border shadow-xl overflow-hidden">
          <div className="px-8 py-5 border-b bg-gray-50/80 flex items-center gap-3">
            <Activity size={18} className="text-zinc-500" />
            <h2 className="text-base font-black text-gray-900 tracking-tight">{format(calcMonth, 'yyyy年MM月')}排班进度</h2>
          </div>
          <div className="px-12 py-8">
            <div className="flex items-start">
              {/* 节点1: 确认排班配置 */}
              <div className="flex flex-col items-center" style={{ minWidth: 140 }}>
                <div className={`w-11 h-11 rounded-full flex items-center justify-center shadow-md transition-all ${node1Status === 'done' ? 'bg-green-500 text-white' :
                  node1Status === 'progress' ? 'bg-amber-400 text-white' :
                    'bg-gray-100 text-gray-400 border-2 border-dashed border-gray-200'
                  }`}>
                  {node1Status === 'done' ? <CheckCircle2 size={18} /> :
                    node1Status === 'progress' ? <Clock size={17} /> :
                      <span className="text-sm font-black">1</span>}
                </div>
                <div className="mt-3 text-center">
                  <div className="text-xs font-black text-gray-800">确认排班配置</div>
                  <div className={`text-[10px] font-bold mt-0.5 ${node1Status === 'done' ? 'text-green-500' :
                    node1Status === 'progress' ? 'text-amber-500' : 'text-gray-300'
                    }`}>{node1Status === 'done' ? '已完成' : node1Status === 'progress' ? '进行中' : '未开始'}</div>
                  <div className="text-[10px] text-gray-300 mt-0.5">前月18~20日</div>
                </div>
              </div>
              {/* 连接线 1→2 */}
              <div className="flex-1 pt-5">
                <div className="relative h-1 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`absolute left-0 h-full rounded-full transition-all duration-700 ${node2Status === 'done' ? 'w-full bg-green-400' :
                    node2Status === 'progress' ? 'w-1/2 bg-amber-300' : 'w-0'
                    }`} />
                </div>
              </div>
              {/* 节点2: 轮休意愿采集 */}
              <div className="flex flex-col items-center" style={{ minWidth: 140 }}>
                <div className={`w-11 h-11 rounded-full flex items-center justify-center shadow-md transition-all ${node2Status === 'done' ? 'bg-green-500 text-white' :
                  node2Status === 'progress' ? 'bg-amber-400 text-white' :
                    'bg-gray-100 text-gray-400 border-2 border-dashed border-gray-200'
                  }`}>
                  {node2Status === 'done' ? <CheckCircle2 size={18} /> :
                    node2Status === 'progress' ? <Clock size={17} /> :
                      <span className="text-sm font-black">2</span>}
                </div>
                <div className="mt-3 text-center">
                  <div className="text-xs font-black text-gray-800">轮休意愿采集</div>
                  <div className={`text-[10px] font-bold mt-0.5 ${node2Status === 'done' ? 'text-green-500' :
                    node2Status === 'progress' ? 'text-amber-500' : 'text-gray-300'
                    }`}>{node2Status === 'done' ? '已完成' : node2Status === 'progress' ? '进行中' : '未开始'}</div>
                  <div className="text-[10px] text-gray-300 mt-0.5">前月20~22日</div>
                </div>
              </div>
              {/* 连接线 2→3 */}
              <div className="flex-1 pt-5">
                <div className="relative h-1 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`absolute left-0 h-full rounded-full transition-all duration-700 ${node3Status === 'done' ? 'w-full bg-green-400' :
                    node3Status === 'progress' ? 'w-1/2 bg-amber-300' : 'w-0'
                    }`} />
                </div>
              </div>
              {/* 节点3: 排班计算 */}
              <div className="flex flex-col items-center" style={{ minWidth: 140 }}>
                <div className={`w-11 h-11 rounded-full flex items-center justify-center shadow-md transition-all ${node3Status === 'done' ? 'bg-green-500 text-white' :
                  node3Status === 'progress' ? 'bg-amber-400 text-white' :
                    'bg-gray-100 text-gray-400 border-2 border-dashed border-gray-200'
                  }`}>
                  {node3Status === 'done' ? <CheckCircle2 size={18} /> :
                    node3Status === 'progress' ? <Clock size={17} /> :
                      <span className="text-sm font-black">3</span>}
                </div>
                <div className="mt-3 text-center">
                  <div className="text-xs font-black text-gray-800">排班计算</div>
                  <div className={`text-[10px] font-bold mt-0.5 ${node3Status === 'done' ? 'text-green-500' :
                    node3Status === 'progress' ? 'text-amber-500' : 'text-gray-300'
                    }`}>{node3Status === 'done' ? '已完成' : node3Status === 'progress' ? '进行中' : '未开始'}</div>
                  <div className="text-[10px] text-gray-300 mt-0.5">前月22日后</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ③ 预设休息日统计表 */}
        <div className="bg-white rounded-[2rem] border shadow-xl overflow-hidden">
          <div className="px-8 py-5 border-b bg-gray-50/80 flex items-center gap-3">
            <Activity size={18} className="text-zinc-500" />
            <h2 className="text-base font-black text-gray-900 tracking-tight">预设休息日统计</h2>
            <div className="ml-auto flex items-center gap-3">
              {/* 是否开放预填开关 */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-500">开放预填</span>
                <button
                  onClick={() => setPrefillOpenMap(prev => ({ ...prev, [progressMonthYM]: !effectivePrefillOpen }))}
                  className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none ${effectivePrefillOpen ? 'bg-green-500' : 'bg-gray-200'
                    }`}
                >
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${effectivePrefillOpen ? 'translate-x-4' : 'translate-x-0.5'
                    }`} />
                </button>
                <span className="text-[10px] font-medium text-gray-400">将于每月20日自动开放次月预填</span>
              </div>
              <div className="w-px h-4 bg-gray-200" />
              <button
                onClick={() => setEditingCalcHoliday(e => !e)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${editingCalcHoliday ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                  }`}
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
                          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-base shadow-md ${m.submitted ? 'bg-zinc-900 text-white' : 'bg-gray-100 text-gray-400'
                            }`}>{m.name[0]}</div>
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
                          <div className={`h-full rounded-full transition-all duration-700 ${offPct >= 100 ? 'bg-green-500' : offPct > 60 ? 'bg-orange-400' : 'bg-gray-200'
                            }`} style={{ width: `${offPct}%` }} />
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
                              onClick={() => setMemberHolidayDays(prev => ({ ...prev, [m.name]: Math.max(0, (prev[m.name] ?? legalHolidayCount) - 1) }))}
                              className="w-6 h-6 rounded-lg bg-gray-100 hover:bg-gray-200 font-black text-gray-600 flex items-center justify-center transition-colors"
                            >−</button>
                            <span className={`text-xl font-black w-8 text-center ${hdDays > 0 ? 'text-indigo-600' : 'text-gray-300'}`}>{hdDays}</span>
                            <button
                              disabled={(memberHolidayDays[m.name] ?? legalHolidayCount) >= legalHolidayCount}
                              onClick={() => setMemberHolidayDays(prev => ({ ...prev, [m.name]: Math.min(legalHolidayCount, (prev[m.name] ?? legalHolidayCount) + 1) }))}
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

        {/* ⑤ 日历展示（底部，样式与休息日预填对齐，等比缩小） */}
        <div className="rounded-[2rem] overflow-hidden shadow-xl border border-zinc-200">
          {/* 深色顶栏 */}
          <div className="bg-zinc-900 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CalendarDays size={18} className="text-zinc-400" />
              <span className="text-white font-black text-base">{format(calcMonth, 'yyyy年MM月')} · 日历</span>
            </div>
            <div className="flex items-center gap-2">
              {editingCalcCalendar && (
                <button
                  onClick={() => {
                    // 取消：恢复到编辑前的快照
                    setCalcDayTypeOverrides(calcDayTypeOverridesDraft);
                    setCalcDayMinStaffOverrides(calcDayMinStaffOverridesDraft);
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
                    // 校验：每日最低排班人数不得大于参与排班的客服人数
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
                    if (overLimit) {
                      alert('超出客服最大人数');
                      return;
                    }
                    // 保存：自动修正——凡当前为工作日且下一天为周末/法定节假日的，清除手动覆盖使其自动显示为假前一日
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
                          if (nb === '周末' || nb === '法定节假日') {
                            delete next[ymd]; // 清除覆盖，令其自动展示为假前一日
                          }
                        }
                      });
                      return next;
                    });
                    setEditingCalcCalendar(false);
                  } else {
                    // 进入编辑模式：保存当前状态快照用于取消恢复
                    setCalcDayTypeOverridesDraft({ ...calcDayTypeOverrides });
                    setCalcDayMinStaffOverridesDraft({ ...calcDayMinStaffOverrides });
                    setEditingCalcCalendar(true);
                  }
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${editingCalcCalendar
                  ? 'bg-white text-zinc-900 border-white'
                  : 'bg-white/10 text-zinc-300 border-white/20 hover:bg-white/20'
                  }`}
              >
                {editingCalcCalendar ? <><CheckCircle2 size={13} /> 保存</> : <><RefreshCw size={13} /> 编辑日历</>}
              </button>
            </div>
          </div>

          {/* 图例栏 */}
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

          {/* 星期表头 */}
          <div className="bg-zinc-800 border-t border-zinc-700 grid grid-cols-7">
            {['日', '一', '二', '三', '四', '五', '六'].map(d => (
              <div key={d} className="py-2 text-center text-xs font-black text-zinc-500 tracking-widest">{d}</div>
            ))}
          </div>

          {/* 日历格子 */}
          <div className="bg-gray-50 p-3 grid grid-cols-7 gap-1.5">
            {/* 空白格 */}
            {Array.from({ length: startDow }).map((_, i) => (
              <div key={`blank-${i}`} className="rounded-xl bg-white/0" />
            ))}
            {/* 日期格 */}
            {days.map((d, i) => {
              const { type, label } = getFinalType(d);
              const ymd = format(d, 'yyyy-MM-dd');
              const bg = typeBg[type] ?? 'bg-white';
              const tc = typeText[type] ?? 'text-gray-700';
              // 编辑模式下拉的当前值：假前一日在 override 里没有存储，显示为工作日（方便用户感知）
              const editValue = calcDayTypeOverrides[ymd] ?? (type === '假前一日' ? '工作日' : getBaseType(d));
              // 每日最低排班人数：优先取每日覆盖值，否则从全局配置按日期类型查找
              const dayMinStaffKey: Record<string, string> = {
                '工作日': '普通工作日', '假前一日': '假前一日', '周末': '周末',
                '法定节假日': '法定节假日', '调休工作日': '调休工作日',
              };
              const effectiveMinStaff = calcDayMinStaffOverrides[ymd] ?? (minStaffConfig[dayMinStaffKey[type] ?? '普通工作日'] ?? 2);
              return (
                <div
                  key={i}
                  className={`${bg} rounded-xl border border-gray-100 p-2 flex flex-col min-h-[88px] transition-all ${editingCalcCalendar ? 'hover:border-zinc-400' : ''} relative`}
                >
                  <div className="flex items-start justify-between">
                    <span className={`text-lg font-black leading-none ${tc}`}>{format(d, 'd')}</span>
                    {/* 最低排班人数 */}
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
                  {/* 编辑模式：日期类型下拉 + 最低排班人数输入 */}
                  {editingCalcCalendar && (
                    <div className="mt-auto pt-1 flex flex-col gap-1">
                      <select
                        value={editValue}
                        onChange={e => setCalcDayTypeOverrides(prev => ({
                          ...prev,
                          [ymd]: e.target.value as '工作日' | '周末' | '法定节假日' | '调休工作日',
                        }))}
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

        {/* ⑥ 已保存排班方案列表 */}
        {savedSchedules.filter(s => s.month === format(calcMonth, 'yyyy-MM')).length > 0 && (
          <div className="bg-white rounded-[2rem] border shadow-xl overflow-hidden">
            <div className="px-8 py-5 border-b bg-gray-50/80 flex items-center gap-3">
              <CalendarDays size={18} className="text-zinc-500" />
              <h2 className="text-base font-black text-gray-900 tracking-tight">已保存方案</h2>
              <span className="text-xs text-gray-400 ml-1">· {format(calcMonth, 'yyyy年MM月')}</span>
            </div>
            <div className="divide-y">
              {savedSchedules
                .filter(s => s.month === format(calcMonth, 'yyyy-MM'))
                .map(s => (
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
                        onClick={() => { setViewingScheduleMode('calendar'); setViewingSchedule(s); }}
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

        {/* ④ 计算按钮区域（置于最底部） */}
        <div className={`rounded-[2rem] border-2 p-8 flex items-center justify-between gap-8 transition-all ${calcDone ? 'bg-green-50 border-green-200' : 'bg-white border-gray-100 shadow-xl'
          }`}>
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
            className={`shrink-0 px-12 py-5 rounded-[1.5rem] font-black text-lg shadow-2xl transition-all active:scale-95 flex items-center gap-3 ${calcLoading
              ? 'bg-zinc-700 text-white cursor-not-allowed'
              : 'bg-zinc-900 text-white hover:bg-black shadow-zinc-200'
              }`}
          >
            {calcLoading ? (
              <><Loader2 size={22} className="animate-spin" /> 计算中...</>
            ) : (
              <><Cpu size={22} /> 开始排班计算</>
            )}
          </button>
        </div>

      </div>
    );
  };

  const renderMembersView = () => (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-black text-gray-900">客服人员管理</h2>
        <button
          onClick={() => { setAddMemberName(''); setAddMemberRole('租号客服'); setShowAddMemberModal(true); }}
          className="bg-zinc-900 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-black transition-all shadow-md"
        >
          <Plus size={18} /> 添加成员
        </button>
      </div>
      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">姓名</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">岗位</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">状态</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">参与排班</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {membersList.map((m, i) => (
              <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">
                      {m.name[0]}
                    </div>
                    <span className="font-bold text-gray-900">{m.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600 font-medium">{m.role}</td>
                <td className="px-6 py-4">
                  <span className="px-2.5 py-1 rounded-full bg-green-100 text-green-700 text-[10px] font-black uppercase">
                    {m.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-center">
                  <button
                    onClick={() => {
                      const newVal = m.inSchedule ? 0 : 1;
                      paibanFetch('/api/paiban/member/inSchedule', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: m.id, inSchedule: newVal }) })
                        .then(r => r.json()).then(res => {
                          if (res.code === '0') {
                            paibanFetch('/api/paiban/member/list').then(r => r.json()).then(res2 => { if (res2.code === '0') setMembers(res2.data); });
                          }
                        });
                    }}
                    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none ${m.inSchedule ? 'bg-green-500' : 'bg-gray-200'
                      }`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${m.inSchedule ? 'translate-x-4' : 'translate-x-0.5'
                      }`} />
                  </button>
                </td>
                <td className="px-6 py-4 text-right space-x-4">
                  <button
                    onClick={() => { setEditMemberIdx(i); setEditMemberName(m.name); setEditMemberRole(m.role as '租号客服' | '卖号客服' | '管理员'); setShowEditMemberModal(true); }}
                    className="text-gray-400 hover:text-blue-600 transition-colors text-sm"
                  >修改</button>
                  <button
                    onClick={() => {
                      paibanFetch('/api/paiban/member/remove', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: m.id }) })
                        .then(r => r.json()).then(res => {
                          if (res.code === '0') {
                            paibanFetch('/api/paiban/member/list').then(r => r.json()).then(res2 => { if (res2.code === '0') setMembers(res2.data); });
                          }
                        });
                    }}
                    className="text-gray-400 hover:text-red-600 transition-colors text-sm"
                  >移除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 添加成员弹窗 */}
      {showAddMemberModal && (
        <div className="fixed inset-0 z-[300] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm p-8 space-y-5">
            <h3 className="text-xl font-black text-gray-900">添加成员</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1 block">姓名 <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={addMemberName}
                  onChange={e => setAddMemberName(e.target.value)}
                  placeholder="请输入姓名"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1 block">岗位</label>
                <select
                  value={addMemberRole}
                  onChange={e => setAddMemberRole(e.target.value as '租号客服' | '卖号客服' | '管理员')}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all hover:border-gray-300"
                >
                  <option value="租号客服">租号客服</option>
                  <option value="卖号客服">卖号客服</option>
                  <option value="管理员">管理员</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowAddMemberModal(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-all"
              >取消</button>
              <button
                disabled={!addMemberName.trim()}
                onClick={() => {
                  if (!addMemberName.trim()) return;
                  paibanFetch('/api/paiban/member/add', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ adminUserId: 0, name: addMemberName.trim(), role: addMemberRole }),
                  }).then(r => r.json()).then(res => {
                    if (res.code === '0') {
                      paibanFetch('/api/paiban/member/list').then(r => r.json()).then(res2 => { if (res2.code === '0') setMembers(res2.data); });
                    }
                    setShowAddMemberModal(false);
                    setAddMemberName('');
                  });
                }}
                className="flex-1 px-4 py-2.5 rounded-xl bg-zinc-900 text-white text-sm font-bold hover:bg-black transition-all disabled:opacity-40"
              >确认添加</button>
            </div>
          </div>
        </div>
      )}

      {/* 修改成员弹窗 */}
      {showEditMemberModal && editMemberIdx !== null && (
        <div className="fixed inset-0 z-[300] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm p-8 space-y-5">
            <h3 className="text-xl font-black text-gray-900">修改成员信息</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1 block">姓名 <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={editMemberName}
                  onChange={e => setEditMemberName(e.target.value)}
                  placeholder="请输入姓名"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1 block">岗位</label>
                <select
                  value={editMemberRole}
                  onChange={e => setEditMemberRole(e.target.value as '租号客服' | '卖号客服' | '管理员')}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all hover:border-gray-300"
                >
                  <option value="租号客服">租号客服</option>
                  <option value="卖号客服">卖号客服</option>
                  <option value="管理员">管理员</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowEditMemberModal(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-all"
              >取消</button>
              <button
                disabled={!editMemberName.trim()}
                onClick={() => {
                  if (!editMemberName.trim() || editMemberIdx === null) return;
                  const targetMember = membersList[editMemberIdx];
                  if (!targetMember) return;
                  paibanFetch('/api/paiban/member/update', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: targetMember.id, name: editMemberName.trim(), role: editMemberRole }),
                  }).then(r => r.json()).then(res => {
                    if (res.code === '0') {
                      paibanFetch('/api/paiban/member/list').then(r => r.json()).then(res2 => { if (res2.code === '0') setMembers(res2.data); });
                    }
                    setShowEditMemberModal(false);
                  });
                }}
                className="flex-1 px-4 py-2.5 rounded-xl bg-zinc-900 text-white text-sm font-bold hover:bg-black transition-all disabled:opacity-40"
              >确认修改</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderInitView = () => (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white p-8 rounded-2xl shadow-sm border">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
          <RefreshCw className={`text-blue-500 ${initLoading ? 'animate-spin' : ''}`} /> 下月排班初始化
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <label className="block text-sm font-bold text-gray-700">选择目标月份</label>
            <input
              type="month"
              defaultValue={format(addMonths(new Date(), 1), 'yyyy-MM')}
              className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <p className="text-xs text-gray-500 leading-relaxed">
              系统将根据下月日历（识别周末、法定节假日、调休日）自动计算每人应排班天数。
              <br />公式：应排天数 = 工作日 + 法定加班日 - 已录入请假。
            </p>
            <button
              onClick={handleInit}
              disabled={initLoading}
              className={`w-full py-4 ${initSuccess ? 'bg-green-600' : 'bg-blue-600'} text-white rounded-xl font-bold hover:opacity-90 transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2`}
            >
              {initLoading ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  正在计算规则...
                </>
              ) : initSuccess ? (
                '初始化成功！已发送通知'
              ) : (
                '立即开始初始化 (Phase 1)'
              )}
            </button>
          </div>
          <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
            <h3 className="font-bold text-blue-900 mb-3 flex items-center gap-2">
              <AlertCircle size={18} /> 注意事项
            </h3>
            <ul className="text-sm text-blue-800 space-y-2 list-disc pl-4">
              <li>初始化后将通过飞书自动通知组负责人校验。</li>
              <li>负责人确认后，系统将开启第三阶段（意愿采集）。</li>
              <li>该操作会重置目标月份的所有已存在规则。</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );

  // ========== 对调校验逻辑 ==========
  const validateSwapResult = (schedule: Record<string, Record<number, '早' | '晚' | '休' | '假'>>, month: string): string | null => {
    const mDate = new Date(month + '-01');
    const mStart = startOfMonth(mDate);
    const mEnd = endOfMonth(mStart);
    const mDays = eachDayOfInterval({ start: mStart, end: mEnd });
    const mHolPrefix = format(mDate, 'yyyy/MM');
    const mHols = globalHolidayConfig.filter(h => h.date.startsWith(mHolPrefix));
    const mPubHols = new Set(mHols.filter(h => h.type === '节假日').map(h => h.date.replace(/\//g, '-')));
    const mMakeup = new Set(mHols.filter(h => h.type === '调休上班日').map(h => h.date.replace(/\//g, '-')));
    const getMDayTypeKey = (day: Date): string => {
      const ymd = format(day, 'yyyy-MM-dd');
      if (mPubHols.has(ymd)) return '法定节假日';
      if (mMakeup.has(ymd)) return '调休工作日';
      const dow = getDay(day);
      if (dow === 0 || dow === 6) return '周末';
      if (mPubHols.has(format(addDays(day, 1), 'yyyy-MM-dd'))) return '假前一日';
      return '普通工作日';
    };
    const mNormalWorkDayCount = mDays.filter(d => {
      const t = getMDayTypeKey(d);
      return t === '普通工作日' || t === '假前一日' || t === '调休工作日';
    }).length;
    const mLegalHolidayCount = mHols.filter(h => h.isLegal).length;

    // Only validate members who have schedules in this month
    const scheduledMembers = membersList.filter(m => schedule[m.name] && Object.keys(schedule[m.name]).length > 0);

    // rule5: work day count
    for (const m of scheduledMembers) {
      const legalWork = memberHolidayDays[m.name] ?? mLegalHolidayCount;
      const leaveCnt = mDays.filter(d => schedule[m.name]?.[parseInt(format(d, 'd'))] === '假').length;
      const requiredWorkDays = mNormalWorkDayCount + legalWork - leaveCnt;
      const actualWorkDays = mDays.filter(d => { const s = schedule[m.name]?.[parseInt(format(d, 'd'))]; return s === '早' || s === '晚'; }).length;
      if (actualWorkDays !== requiredWorkDays) return `排班天数不符合：${m.name} 应排 ${requiredWorkDays} 天，实际 ${actualWorkDays} 天，请确认。`;
    }
    // rule1: consecutive >6
    for (const m of scheduledMembers) {
      let consec = 0;
      for (const day of mDays) {
        const dn = parseInt(format(day, 'd'));
        const s = schedule[m.name]?.[dn];
        if (s === '早' || s === '晚') { consec++; if (consec > 6) return `存在连上>6天的情况（${m.name}），请调整。`; }
        else consec = 0;
      }
    }
    // rule2: 晚→早
    for (const m of scheduledMembers) {
      for (let i = 0; i < mDays.length - 1; i++) {
        const d1 = parseInt(format(mDays[i], 'd'));
        const d2 = parseInt(format(mDays[i + 1], 'd'));
        if (schedule[m.name]?.[d1] === '晚' && schedule[m.name]?.[d2] === '早') return `存在晚班转早班的情况（${m.name}），请调整。`;
      }
    }
    // rule4: min staff
    for (const day of mDays) {
      const dn = parseInt(format(day, 'd'));
      const ymd = format(day, 'yyyy-MM-dd');
      const ms = calcDayMinStaffOverrides[ymd] ?? (minStaffConfig[getMDayTypeKey(day)] ?? 1);
      let working = 0;
      scheduledMembers.forEach(m => { const s = schedule[m.name]?.[dn]; if (s === '早' || s === '晚') working++; });
      if (working < ms) return `存在排班人数不足的日期（${format(day, 'M/d')}），请调整。`;
    }
    return null;
  };

  // Build swap pairs from selected days (same day swap: currentUser ↔ targetUser on same day)
  const buildSwapPairs = (days: string[], applied: SavedSchedule | null, target: string): SwapPair[] => {
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

  // Run swap validation and update state
  const runSwapValidation = (days: string[], applied: SavedSchedule | null, target: string) => {
    if (!applied || !target || days.every(d => !d)) {
      setSwapValidationResult(null);
      return;
    }
    const pairs = buildSwapPairs(days, applied, target);
    if (pairs.length === 0) { setSwapValidationResult(null); return; }
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
    if (!boardApplied || !swapTargetUser) return;
    const pairs = buildSwapPairs(swapSelectedDays, boardApplied, swapTargetUser);
    if (pairs.length === 0) { setSwapError('请至少选择一个对调日期。'); return; }
    // Check for duplicates
    const keys = pairs.map(p => p.fromDay);
    if (new Set(keys).size !== keys.length) { setSwapError('存在重复的日期选择，请调整。'); return; }
    // Simulate and validate
    const simSchedule: Record<string, Record<number, '早' | '晚' | '休' | '假'>> = {};
    for (const [k, v] of Object.entries(boardApplied.schedule)) simSchedule[k] = { ...v };
    for (const p of pairs) {
      const curOld = simSchedule[currentUser][p.fromDay];
      const tarOld = simSchedule[swapTargetUser][p.toDay];
      simSchedule[currentUser][p.fromDay] = tarOld;
      simSchedule[swapTargetUser][p.toDay] = curOld;
    }
    const err = validateSwapResult(simSchedule, boardApplied.month);
    if (err) { setSwapError(err); return; }
    const req: SwapRequest = {
      id: Date.now().toString(),
      fromUser: currentUser,
      toUser: swapTargetUser,
      month: boardApplied.month,
      swaps: pairs,
      status: '待处理',
      createdAt: new Date().toISOString(),
    };
    setSwapRequests(prev => [...prev, req]);
    setBoardEditLogs(prev => [{ id: Date.now().toString() + 's', month: req.month, editor: currentUser, timestamp: new Date().toISOString(), type: 'swap_request' as const, swapFrom: req.fromUser, swapTo: req.toUser, swapPairs: req.swaps.map(p => ({ fromDay: p.fromDay, fromShift: p.fromShift, toDay: p.toDay, toShift: p.toShift })) }, ...prev]);
    setShowSwapModal(false);
    setSwapError(null);
    setSwapValidationResult(null);
  };

  const handleSwapApprove = (req: SwapRequest) => {
    const applied = appliedSchedules[req.month];
    if (!applied) return;
    // Simulate and validate
    const simSchedule: Record<string, Record<number, '早' | '晚' | '休' | '假'>> = {};
    for (const [k, v] of Object.entries(applied.schedule)) simSchedule[k] = { ...v };
    for (const p of req.swaps) {
      const curOld = simSchedule[req.fromUser][p.fromDay];
      const tarOld = simSchedule[req.toUser][p.toDay];
      simSchedule[req.fromUser][p.fromDay] = tarOld;
      simSchedule[req.toUser][p.toDay] = curOld;
    }
    const err = validateSwapResult(simSchedule, req.month);
    if (err) { setSwapError(err); setShowSwapDetail(req); return; }
    // Apply swap
    const newApplied = { ...applied, schedule: simSchedule };
    setAppliedSchedules(prev => ({ ...prev, [req.month]: newApplied }));
    setSwapRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: '已同意' as const } : r));
    setBoardEditLogs(prev => [{ id: Date.now().toString() + 'a', month: req.month, editor: currentUser, timestamp: new Date().toISOString(), type: 'swap_approve' as const, swapFrom: req.fromUser, swapTo: req.toUser, swapPairs: req.swaps.map(p => ({ fromDay: p.fromDay, fromShift: p.fromShift, toDay: p.toDay, toShift: p.toShift })) }, ...prev]);
    setShowSwapDetail(null);
  };

  const handleSwapReject = (req: SwapRequest) => {
    setSwapRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: '已拒绝' as const } : r));
    setBoardEditLogs(prev => [{ id: Date.now().toString() + 'r', month: req.month, editor: currentUser, timestamp: new Date().toISOString(), type: 'swap_reject' as const, swapFrom: req.fromUser, swapTo: req.toUser, swapPairs: req.swaps.map(p => ({ fromDay: p.fromDay, fromShift: p.fromShift, toDay: p.toDay, toShift: p.toShift })) }, ...prev]);
    setShowSwapDetail(null);
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex flex-col">
      {/* 顶部标签页 */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <div className="bg-blue-600 p-1.5 rounded-lg">
                <CalendarIcon className="text-white" size={20} />
              </div>
              <span className="text-lg font-black tracking-tighter text-gray-900">客服排班系统 V2</span>
            </div>

            <nav className="flex gap-1 bg-gray-100 p-1 rounded-xl">
              {[
                { id: 'calendar', label: '排班看板', icon: CalendarIcon },
                { id: 'leave-request', label: '休息日预填', icon: RefreshCw },
                ...(isAdmin ? [
                  { id: 'schedule-calc', label: '排班计算', icon: Cpu },
                  { id: 'members', label: '成员管理', icon: Users },
                  { id: 'settings', label: '全局配置', icon: Settings },
                ] : []),
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === tab.id
                    ? 'bg-white text-blue-600 shadow-sm ring-1 ring-gray-200'
                    : 'text-gray-500 hover:text-gray-900'
                    }`}
                >
                  <tab.icon size={16} />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>


        </div>
      </header>

      {/* 主内容区 */}
      <main className="flex-1 p-6 max-w-[1600px] mx-auto w-full">
        {activeTab === 'calendar' ? (
          <div className="space-y-6">
            {/* 我的排班统计面板 - 嵌入看板 */}
            {(() => {
              const myData = boardData.find(p => p.name === currentUser);
              const earlyCount = myData ? myData.schedules.filter(s => s.shift === '早').length : 0;
              const lateCount = myData ? myData.schedules.filter(s => s.shift === '晚').length : 0;
              const workCount = earlyCount + lateCount;
              const restCount = myData ? myData.schedules.filter(s => s.shift === '休' || s.shift === '假').length : 0;
              return (
                <div className="bg-gradient-to-br from-zinc-900 to-black p-6 rounded-[2rem] shadow-2xl border border-white/10 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                    <Clock size={120} className="text-white" />
                  </div>
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
                              <span className="text-[10px] bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full border border-blue-500/30 uppercase tracking-widest font-black">Online</span>
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
                      <div className="px-8 py-5 bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl group hover:border-blue-500/50 transition-all">
                        <div className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-2">早班总计</div>
                        <div className="flex items-end gap-2">
                          <span className="text-4xl font-black text-white">{earlyCount}</span>
                          <span className="text-xs font-bold text-zinc-500 mb-1.5 font-mono">DAYS</span>
                        </div>
                      </div>
                      <div className="px-8 py-5 bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl group hover:border-indigo-500/50 transition-all">
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

            <div className="flex justify-between items-end">
              <div>
                <h1 className="text-3xl font-black text-gray-900 tracking-tight">
                  {format(calendarDisplayDate, 'yyyy年 MM月', { locale: zhCN })}
                </h1>
                <div className="flex gap-4 mt-2">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span> 早班: 09:00 - 17:00
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
                    <span className="w-2 h-2 rounded-full bg-indigo-500"></span> 晚班: 13:00 - 21:00
                  </div>
                </div>
              </div>

              {/* 本月 / 下月 切换 — 居中，基于当天日期固定 */}
              <div className="flex gap-2 bg-gray-100 p-1 rounded-2xl">
                <button
                  onClick={() => { setCurrentDate(new Date(2026, 2, 5)); setCalendarViewMode('current'); }}
                  className={`px-6 py-2 rounded-xl text-sm font-black transition-all ${calendarViewMode === 'current'
                    ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200'
                    : 'text-gray-400 hover:text-gray-700'
                    }`}
                >
                  本月 · {format(new Date(2026, 2, 5), 'MM月', { locale: zhCN })}
                </button>
                <button
                  onClick={() => { setCurrentDate(new Date(2026, 2, 5)); setCalendarViewMode('next'); }}
                  className={`px-6 py-2 rounded-xl text-sm font-black transition-all ${calendarViewMode === 'next'
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
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
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
                    onChange={e => setOnlyMe(e.target.checked)}
                    className="w-4 h-4 rounded accent-blue-600 cursor-pointer"
                  />
                  <span className="text-sm font-bold text-gray-700">仅看自己</span>
                </label>
                <div className="flex border rounded-xl bg-white shadow-sm">
                  <button onClick={prevMonth} className="p-2.5 hover:bg-gray-50 border-r transition-colors">
                    <ChevronLeft size={20} />
                  </button>
                  <button onClick={() => { setCurrentDate(new Date(2026, 2, 5)); setCalendarViewMode('current'); }} className="px-4 text-sm font-bold hover:bg-gray-50 transition-colors">
                    回到今天
                  </button>
                  <button onClick={nextMonth} className="p-2.5 hover:bg-gray-50 border-l transition-colors">
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
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold active:scale-95 ${currentUserHasSchedule ? 'bg-zinc-900 text-white shadow-lg hover:bg-black' : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                >
                  <ArrowLeftRight size={18} /> 发起对调
                </button>
                <button
                  onClick={() => setScheduleViewMode(m => m === 'calendar' ? 'table' : 'calendar')}
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
              const pendingSwaps = swapRequests.filter(r =>
                r.status === '待处理' && r.month === boardMonthKey &&
                (r.fromUser === currentUser || r.toUser === currentUser)
              );
              const recentSwaps = swapRequests.filter(r =>
                r.status !== '待处理' && r.month === boardMonthKey &&
                (r.fromUser === currentUser || r.toUser === currentUser)
              ).slice(-3);
              if (pendingSwaps.length === 0 && recentSwaps.length === 0) return null;
              return (
                <div className="bg-white rounded-2xl border shadow-sm p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-bold text-gray-700">
                    <ArrowLeftRight size={16} className="text-yellow-600" />
                    对调申请
                  </div>
                  {pendingSwaps.map(req => (
                    <div key={req.id} className="flex items-center gap-4 bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3">
                      <div className="flex-1">
                        <div className="text-sm font-bold text-gray-900">
                          {req.fromUser} ↔ {req.toUser}
                          <span className="ml-2 text-xs font-bold text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-lg border border-yellow-200">待处理</span>
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
                  {recentSwaps.map(req => (
                    <div key={req.id} className={`flex items-center gap-4 rounded-xl px-4 py-3 border ${req.status === '已同意' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                      }`}>
                      <div className="flex-1">
                        <div className="text-sm font-bold text-gray-900">
                          {req.fromUser} ↔ {req.toUser}
                          <span className={`ml-2 text-xs font-bold px-2 py-0.5 rounded-lg border ${req.status === '已同意' ? 'text-green-700 bg-green-100 border-green-200' : 'text-red-700 bg-red-100 border-red-200'
                            }`}>{req.status}</span>
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

            {loading ? (
              <div className="h-[600px] flex items-center justify-center">
                <Loader2 className="animate-spin text-blue-500" size={48} />
              </div>
            ) : scheduleViewMode === 'table' ? renderTableView() : renderCalendar()}

            {/* 排班调整日志看板 */}
            {(() => {
              const monthLogs = boardEditLogs.filter(l => l.month === boardMonthKey);
              const shiftColor: Record<string, string> = {
                '早': 'bg-blue-100 text-blue-700 border-blue-200',
                '晚': 'bg-indigo-100 text-indigo-700 border-indigo-200',
                '休': 'bg-orange-50 text-orange-500 border-orange-200',
                '假': 'bg-gray-100 text-gray-400 border-gray-200',
                '': 'bg-gray-100 text-gray-400 border-dashed border-gray-300',
              };
              return (
                <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                  <button
                    onClick={() => setBoardLogOpen(o => !o)}
                    className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors text-left"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-violet-500 shrink-0"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="1" /><path d="M9 12h6M9 16h4" /></svg>
                    <span className="text-sm font-bold text-gray-800">排班调整记录</span>
                    {monthLogs.length > 0 && (
                      <span className="ml-1 text-[11px] font-black bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">{monthLogs.length} 条</span>
                    )}
                    <span className="ml-auto text-xs text-gray-400 font-medium">{boardMonthKey}</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`text-gray-400 transition-transform shrink-0 ${boardLogOpen ? 'rotate-180' : ''}`}><path d="m6 9 6 6 6-6" /></svg>
                  </button>

                  {boardLogOpen && (
                    <div className="border-t">
                      {monthLogs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 gap-2 text-gray-400">
                          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="1" /><path d="M9 12h6M9 16h4" /></svg>
                          <span className="text-sm font-medium">本月暂无排班调整记录</span>
                        </div>
                      ) : (
                        <div className="divide-y">
                          {monthLogs.map(log => {
                            const dt = new Date(log.timestamp);
                            const timeStr = `${dt.getMonth() + 1}/${dt.getDate()} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
                            // 图标 & 标签配置
                            const logMeta: Record<string, { icon: React.ReactNode; badge: React.ReactNode; detail: React.ReactNode }> = {
                              edit: {
                                icon: <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center shrink-0"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg></div>,
                                badge: <span className="text-xs text-gray-400">手动修改了 <span className="font-black text-gray-700">{log.changes?.length ?? 0}</span> 个排班格</span>,
                                detail: (() => {
                                  const byMember: Record<string, NonNullable<typeof log.changes>> = {};
                                  (log.changes ?? []).forEach(c => { (byMember[c.name] ??= []).push(c); });
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
          </div>
        ) : activeTab === 'leave-request' ? (
          renderLeaveRequestView()
        ) : activeTab === 'schedule-calc' ? (
          renderScheduleCalcView()
        ) : activeTab === 'members' ? (
          renderMembersView()
        ) : (
          <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4">
            <div>
              <h1 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                <span className="bg-zinc-900 text-white p-2 rounded-2xl"><Settings size={24} /></span>
                全局配置
              </h1>
              <p className="text-sm text-gray-400 mt-1 font-medium">排班规则、节假日配置级全局参数管理</p>
            </div>

            {/* 最小排班配置 */}
            <div className="bg-white rounded-[2rem] border shadow-xl overflow-hidden">
              <div className="px-8 py-5 border-b bg-gray-50/80 flex items-center gap-3">
                <CalendarDays size={18} className="text-zinc-500" />
                <h2 className="text-base font-black text-gray-900">最小排班配置</h2>
                <button
                  onClick={async () => {
                    if (editingMinStaff) {
                      // 保存：PUT 到 API，同步 minStaffConfig
                      try {
                        await fetch('/api/config/min-staff', {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(minStaffDraft),
                        });
                        setMinStaffConfig({ ...minStaffDraft });
                      } catch (e) { console.error(e); }
                    } else {
                      // 进入编辑：从已保存的 config 初始化草稿
                      setMinStaffDraft({ ...minStaffConfig });
                    }
                    setEditingMinStaff(e => !e);
                  }}
                  className={`ml-auto flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border transition-all ${editingMinStaff ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                    }`}
                >
                  {editingMinStaff ? <><CheckCircle2 size={15} /> 保存</> : <><RefreshCw size={15} /> 编辑</>}
                </button>
              </div>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b text-xs font-bold text-gray-500 uppercase tracking-wide">
                    <th className="px-8 py-3 text-left">日期类型</th>
                    <th className="px-8 py-3 text-center">最小排班人数</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(['普通工作日', '假前一日', '周末', '调休工作日', '法定节假日'] as const).map(type => (
                    <tr key={type} className="hover:bg-gray-50/40">
                      <td className="px-8 py-4 font-semibold text-gray-800">{type}</td>
                      <td className="px-8 py-4 text-center">
                        {editingMinStaff ? (
                          <input
                            type="number"
                            value={minStaffDraft[type] ?? 1}
                            min={0}
                            onChange={e => setMinStaffDraft(prev => ({ ...prev, [type]: Number(e.target.value) }))}
                            className="w-20 text-center border border-gray-300 rounded-lg px-2 py-1 font-black text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
                          />
                        ) : (
                          <span className="font-black text-gray-800 text-base">{minStaffConfig[type] ?? 1} <span className="text-xs font-normal text-gray-400">人</span></span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 节假日配置 */}
            <div className="bg-white rounded-[2rem] border shadow-xl overflow-hidden">
              <div className="px-8 py-5 border-b bg-gray-50/80 flex items-center gap-3">
                <CalendarDays size={18} className="text-green-600" />
                <h2 className="text-base font-black text-gray-900">节假日配置</h2>
                <div className="ml-auto flex items-center gap-2">
                  {editingHoliday && (
                    <button
                      onClick={() => setHolidayDraft(prev => [...prev, { date: '', name: '春节', type: '节假日' as const, isLegal: false }])}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold border border-dashed border-gray-300 text-gray-600 hover:bg-gray-50 transition-all"
                    >
                      <Plus size={14} /> 新增一行
                    </button>
                  )}
                  <button
                    onClick={() => { setHolidayImportText(''); setHolidayImportPreview(null); setShowHolidayImportModal(true); }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-all"
                  >
                    <Plus size={15} /> 批量新增
                  </button>
                  <button
                    onClick={async () => {
                      if (editingHoliday) {
                        // 保存：PUT 到 API，同步 globalHolidayConfig
                        try {
                          await fetch('/api/config/holidays', {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(holidayDraft),
                          });
                          setGlobalHolidayConfig([...holidayDraft]);
                        } catch (e) { console.error(e); }
                      } else {
                        // 进入编辑：从已保存的 config 初始化草稿
                        setHolidayDraft([...globalHolidayConfig]);
                      }
                      setEditingHoliday(e => !e);
                    }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border transition-all ${editingHoliday ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                      }`}
                  >
                    {editingHoliday ? <><CheckCircle2 size={15} /> 保存</> : <><RefreshCw size={15} /> 编辑</>}
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b text-xs font-bold text-gray-500 uppercase tracking-wide">
                      <th className="px-6 py-3 text-left">日期</th>
                      <th className="px-6 py-3 text-left">节假日名称</th>
                      <th className="px-6 py-3 text-center">日期类型</th>
                      <th className="px-6 py-3 text-center">是否法定节假日</th>
                      {editingHoliday && <th className="px-4 py-3 text-center">操作</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(editingHoliday ? holidayDraft : globalHolidayConfig).map((row, ri) => {
                      const typeStyle = row.type === '节假日'
                        ? 'bg-green-100 text-green-700 border-green-200'
                        : 'bg-orange-100 text-orange-700 border-orange-200';
                      if (!editingHoliday) {
                        return (
                          <tr key={ri} className="hover:bg-gray-50/40">
                            <td className="px-6 py-3 font-mono text-gray-700 text-xs">{row.date}</td>
                            <td className="px-6 py-3 font-semibold text-gray-800">{row.name}</td>
                            <td className="px-6 py-3 text-center">
                              <span className={`inline-block text-[11px] font-bold border rounded-full px-2.5 py-0.5 ${typeStyle}`}>{row.type}</span>
                            </td>
                            <td className="px-6 py-3 text-center">
                              {row.isLegal
                                ? <span className="inline-block bg-green-100 text-green-700 border border-green-200 text-[11px] font-bold rounded-full px-2.5 py-0.5">是</span>
                                : <span className="text-gray-300">&mdash;</span>}
                            </td>
                          </tr>
                        );
                      }
                      // 编辑模式
                      return (
                        <tr key={ri} className="bg-blue-50/20">
                          <td className="px-4 py-2">
                            <input
                              type="text"
                              placeholder="yyyy/MM/dd"
                              value={row.date}
                              onChange={e => setHolidayDraft(prev => prev.map((r, i) => i === ri ? { ...r, date: e.target.value } : r))}
                              className="w-28 border border-gray-300 rounded-lg px-2 py-1 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-400"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <select
                              value={row.name}
                              onChange={e => setHolidayDraft(prev => prev.map((r, i) => i === ri ? { ...r, name: e.target.value } : r))}
                              className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-semibold bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all hover:border-gray-300"
                            >
                              {['元旦', '春节', '清明节', '劳动节', '端午节', '中秋节', '国庆节'].map(n => (
                                <option key={n} value={n}>{n}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-2 text-center">
                            <select
                              value={row.type}
                              onChange={e => setHolidayDraft(prev => prev.map((r, i) => i === ri ? { ...r, type: e.target.value as HolidayRow['type'] } : r))}
                              className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-bold bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all hover:border-gray-300"
                            >
                              <option value="节假日">节假日</option>
                              <option value="调休上班日">调休上班日</option>
                            </select>
                          </td>
                          <td className="px-4 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={row.isLegal}
                              onChange={e => setHolidayDraft(prev => prev.map((r, i) => i === ri ? { ...r, isLegal: e.target.checked } : r))}
                              className="w-4 h-4 accent-green-600 cursor-pointer"
                            />
                          </td>
                          <td className="px-4 py-2 text-center">
                            <button
                              onClick={() => setHolidayDraft(prev => prev.filter((_, i) => i !== ri))}
                              className="text-red-400 hover:text-red-600 text-xs font-bold px-2 py-1 rounded-lg hover:bg-red-50 transition-all"
                            >删除</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 排班计算日志弹窗 */}
      {showCalcModal && (
        <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget && !calcRunning) setShowCalcModal(false); }}>
          <div className="bg-white rounded-[2rem] shadow-2xl flex flex-col w-full max-w-3xl max-h-[85vh] overflow-hidden">
            {/* 弹窗顶栏 */}
            <div className="bg-zinc-900 px-6 py-4 flex items-center gap-3 shrink-0">
              <Cpu size={18} className="text-zinc-400" />
              <span className="text-white font-black text-base">
                {calcRunning ? '排班计算中...' : '排班计算完成'}
              </span>
              <div className="ml-auto flex items-center gap-2">
                {calcRunning && <Loader2 size={16} className="text-zinc-400 animate-spin" />}
                {!calcRunning && (
                  <button onClick={() => setShowCalcModal(false)} className="text-zinc-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12" /></svg>
                  </button>
                )}
              </div>
            </div>

            {/* 日志区 */}
            <div className="flex-1 overflow-y-auto bg-zinc-950 p-5 font-mono text-xs leading-5">
              {calcLogs.map((line, i) => (
                <div key={i} className={`whitespace-pre-wrap ${line.startsWith('  ⚠️') ? 'text-orange-400' :
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
              {calcRunning && (
                <div className="text-zinc-500 animate-pulse mt-1">▌</div>
              )}
            </div>

            {/* 按钮区：计算完成后出现 */}
            {!calcRunning && calcScheduleResult && (
              <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-end gap-3 shrink-0">
                <button
                  onClick={async () => {
                    setCalcScheduleResult(null);
                    setCalcLogs([]);
                    setCalcDone(false);
                    setShowCalcModal(true);
                    setCalcRunning(true);
                    setCalcLoading(true);
                    try {
                      const result = await runCalcWithRetry();
                      setCalcScheduleResult(result);
                    } catch (e) { console.error(e); }
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
              <button
                onClick={() => setShowApplyOverwriteConfirm(null)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-all"
              >取消</button>
              <button
                onClick={() => doApply(showApplyOverwriteConfirm)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-all"
              >确认覆盖</button>
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
              <button
                onClick={() => setShowApplySuccess(null)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-all"
              >好的</button>
              <button
                onClick={() => navigateToBoardMonth(showApplySuccess)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-zinc-900 text-white text-sm font-bold hover:bg-black transition-all"
              >前往查看</button>
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
              <button
                onClick={() => setShowSaveNameModal(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-all"
              >取消</button>
              <button
                disabled={!savePlanName.trim()}
                onClick={() => {
                  if (!savePlanName.trim() || !calcScheduleResult) return;
                  const newPlan: SavedSchedule = {
                    id: Date.now().toString(),
                    planName: savePlanName.trim(),
                    month: format(calcMonth, 'yyyy-MM'),
                    schedule: calcScheduleResult,
                  };
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

      {/* 查看已保存方案弹窗（日历形式） */}
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
        const vLegalHols = new Set(vHols.filter(h => h.isLegal).map(h => h.date.replace(/\//g, '-')));
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
        const shiftStyle: Record<string, string> = {
          '早': 'bg-blue-100 text-blue-700 border-blue-200',
          '晚': 'bg-indigo-100 text-indigo-700 border-indigo-200',
          '休': 'bg-orange-50 text-orange-500 border-orange-200',
          '假': 'bg-red-50 text-red-500 border-red-200',
        };
        // 使用 draft（可编辑副本）渲染，未修改时 fallback 到原 schedule
        const draft = viewingDraft ?? viewingSchedule.schedule;
        // 仅包含在此方案中有排班数据的成员
        const scheduledMembersList = membersList.filter(m => draft[m.name] && Object.keys(draft[m.name]).length > 0);
        // ---- 实时校验（仅校验有排班的成员）----
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
        const rule3BadDays: string[] = [];
        vTableDays.forEach(day => {
          const dn = parseInt(format(day, 'd'));
          let early = 0, late = 0;
          scheduledMembersList.forEach(m => { const s = draft[m.name]?.[dn]; if (s === '早') early++; if (s === '晚') late++; });
          const diff = late - early;
          if (diff !== 0 && diff !== 1) rule3BadDays.push(format(day, 'M/d'));
        });
        const rule4BadDays: string[] = [];
        vTableDays.forEach(day => {
          const dn = parseInt(format(day, 'd'));
          const ymd = format(day, 'yyyy-MM-dd');
          const minStaff = calcDayMinStaffOverrides[ymd] ?? (minStaffConfig[getVDayTypeKey(day)] ?? 1);
          let early = 0, late = 0;
          scheduledMembersList.forEach(m => { const s = draft[m.name]?.[dn]; if (s === '早') early++; if (s === '晚') late++; });
          if (early + late < minStaff) rule4BadDays.push(format(day, 'M/d'));
        });
        // rule5：每人排班天数必须严格等于应排班天数
        const vNormalWorkDayCount = vTableDays.filter(d => {
          const t = getVDayTypeKey(d);
          return t === '普通工作日' || t === '假前一日' || t === '调休工作日';
        }).length;
        const vLegalHolidayCount = vHols.filter(h => h.isLegal).length;
        const rule5Bad: { name: string; actual: number; required: number }[] = [];
        scheduledMembersList.forEach(m => {
          const legalWork = memberHolidayDays[m.name] ?? vLegalHolidayCount;
          const leaveCnt = vTableDays.filter(d => draft[m.name]?.[parseInt(format(d, 'd'))] === '假').length;
          const requiredWorkDays = vNormalWorkDayCount + legalWork - leaveCnt;
          const actualWorkDays = vTableDays.filter(d => { const s = draft[m.name]?.[parseInt(format(d, 'd'))]; return s === '早' || s === '晚'; }).length;
          if (actualWorkDays !== requiredWorkDays) rule5Bad.push({ name: m.name, actual: actualWorkDays, required: requiredWorkDays });
        });
        const rule1Pass = rule1Bad.length === 0;
        const rule2Pass = rule2Bad.length === 0;
        const rule5Pass = rule5Bad.length === 0;
        const hardFail = !rule1Pass || !rule2Pass || !rule5Pass;
        const softWarn = rule3BadDays.length > 0 || rule4BadDays.length > 0;
        // ---- 统计（基于 draft，仅统计有排班的成员）----
        const personStats = scheduledMembersList.map(m => {
          const counts = { '早': 0, '晚': 0, '休': 0, '假': 0, '法定': 0 };
          vTableDays.forEach(day => {
            const dn = parseInt(format(day, 'd'));
            const shift = draft[m.name]?.[dn];
            if (!shift) return;
            if (shift === '早' || shift === '晚' || shift === '休' || shift === '假') counts[shift]++;
            if ((shift === '早' || shift === '晚') && vLegalHols.has(format(day, 'yyyy-MM-dd'))) counts['法定']++;
          });
          return { name: m.name, counts };
        });
        const dayStatsV = vTableDays.map(day => {
          const dn = parseInt(format(day, 'd'));
          const counts = { '早': 0, '晚': 0, '休': 0, '假': 0 };
          scheduledMembersList.forEach(m => {
            const shift = draft[m.name]?.[dn];
            if (shift === '早') counts['早']++;
            else if (shift === '晚') counts['晚']++;
            else if (shift === '休') counts['休']++;
            else if (shift === '假') counts['假']++;
          });
          return counts;
        });
        return (
          <div className="fixed inset-0 z-[300] bg-black/70 flex items-center justify-center p-4 overflow-y-auto" onClick={e => { setViewingDropdown(null); if (e.target === e.currentTarget) setViewingSchedule(null); }}>
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-[1200px] overflow-hidden my-4" onClick={() => setViewingDropdown(null)}>
              {/* 顶栏 */}
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
                  {/* 周头 */}
                  <div className="grid grid-cols-7 bg-zinc-800">
                    {['周一', '周二', '周三', '周四', '周五', '周六', '周日'].map(d => (
                      <div key={d} className="py-4 text-center text-[11px] font-black text-zinc-500 uppercase tracking-[0.3em]">{d}</div>
                    ))}
                  </div>
                  {/* 图例 */}
                  <div className="flex items-center gap-6 px-6 py-3 border-b bg-gray-50/60 text-[11px] font-bold">
                    <span className="text-gray-400 uppercase tracking-widest text-[10px]">图例</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-white border border-gray-200 inline-block"></span> 普通工作日</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-yellow-100 border border-yellow-200 inline-block"></span> 周末</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-100 border border-green-200 inline-block"></span> 法定节假日</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-purple-100 border border-purple-200 inline-block"></span> 调休日</span>
                  </div>
                  {/* 日历格子 */}
                  <div className="grid grid-cols-7 border-collapse">
                    {vCalDays.map((day, idx) => {
                      const isCurr = format(day, 'yyyy-MM') === viewingSchedule.month;
                      const ymd = format(day, 'yyyy-MM-dd');
                      const dn = parseInt(format(day, 'd'));
                      const bg = isCurr ? getVDayBg(day) : '';
                      const tag = isCurr ? getVDayTag(day) : null;
                      const isPast = ymd <= today;
                      return (
                        <div key={idx} className={`relative min-h-[160px] border-r border-b border-gray-100 p-3 flex flex-col ${!isCurr ? 'bg-gray-50/50' : isPast ? 'bg-gray-100' : (bg || 'bg-white')
                          }`}>
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
                              {/* 左右分栏：早 | 晚，休/假不显示 */}
                              <div className={`flex-1 grid grid-cols-2 gap-1 overflow-hidden min-h-0 ${isPast ? 'opacity-40' : ''}`}>
                                {/* 早班 */}
                                <div className="flex flex-col gap-0.5 border-r border-gray-100 pr-1 overflow-y-auto">
                                  <div className="text-[9px] font-bold text-blue-500 mb-0.5">早</div>
                                  {membersList.map(m => {
                                    if (draft[m.name]?.[dn] !== '早') return null;
                                    return (
                                      <div key={m.name} className="text-[9px] px-1 py-0.5 rounded border truncate bg-blue-50 text-blue-700 border-blue-100">
                                        {m.name}
                                      </div>
                                    );
                                  })}
                                </div>
                                {/* 晚班 */}
                                <div className="flex flex-col gap-0.5 pl-1 overflow-y-auto">
                                  <div className="text-[9px] font-bold text-indigo-500 mb-0.5">晚</div>
                                  {membersList.map(m => {
                                    if (draft[m.name]?.[dn] !== '晚') return null;
                                    return (
                                      <div key={m.name} className="text-[9px] px-1 py-0.5 rounded border truncate bg-indigo-50 text-indigo-700 border-indigo-100">
                                        {m.name}
                                      </div>
                                    );
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
                /* 表格模式 */
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
                        {/* 合并统计列头：一格五列，sticky right-0 */}
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
                                        }} className={`text-[11px] font-black px-2 py-1 rounded-lg transition-colors ${shift === opt ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100 text-gray-700'
                                          }`}>{opt}</button>
                                      ))}
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                            {/* 合并统计格：一格五列，sticky right-0 */}
                            <td className={`sticky right-0 z-[20] border-l border-b ${rowEven ? 'bg-white' : 'bg-gray-50'}`} style={{ width: '220px', minWidth: '220px' }}>
                              <div className="flex h-full text-[10px]">
                                <div className={`flex-1 flex items-center justify-center border-r border-gray-200 py-2 font-black text-blue-700 ${rowEven ? 'bg-blue-50/60' : 'bg-blue-50'}`}>
                                  {stat['早']}<span className="text-[9px] font-normal text-gray-400 ml-0.5">天</span>
                                </div>
                                <div className={`flex-1 flex items-center justify-center border-r border-gray-200 py-2 font-black text-indigo-700 ${rowEven ? 'bg-indigo-50/60' : 'bg-indigo-50'}`}>
                                  {stat['晚']}<span className="text-[9px] font-normal text-gray-400 ml-0.5">天</span>
                                </div>
                                <div className={`flex-1 flex items-center justify-center border-r border-gray-200 py-2 font-black text-orange-500 ${rowEven ? 'bg-orange-50/60' : 'bg-orange-50'}`}>
                                  {stat['休']}<span className="text-[9px] font-normal text-gray-400 ml-0.5">天</span>
                                </div>
                                <div className={`flex-1 flex items-center justify-center border-r border-gray-200 py-2 font-black text-red-500 ${rowEven ? 'bg-red-50/40' : 'bg-red-50/60'}`}>
                                  {stat['假']}<span className="text-[9px] font-normal text-gray-400 ml-0.5">天</span>
                                </div>
                                <div className={`flex-1 flex items-center justify-center py-2 font-black text-green-600 ${rowEven ? 'bg-green-50/40' : 'bg-green-50/60'}`}>
                                  {stat['法定']}<span className="text-[9px] font-normal text-gray-400 ml-0.5">天</span>
                                </div>
                              </div>
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
                        const total = dayStatsV.reduce((s, ds) => s + ds[dayKey], 0);
                        return (
                          <tr key={key} className={fi === 0 ? 'bg-gray-50 border-t-2 border-gray-200' : 'bg-gray-50'}>
                            <td className="sticky left-0 z-[20] bg-gray-100 border-r border-b px-4 py-2 font-bold whitespace-nowrap">
                              <span className={`inline-block text-[10px] font-black border rounded px-2 py-0.5 ${labelCls}`}>{label}</span>
                            </td>
                            {dayStatsV.map((ds, di) => {
                              const count = ds[dayKey];
                              const day = vTableDays[di];
                              const ymd = format(day, 'yyyy-MM-dd');
                              const isPast = ymd <= today;
                              const cellBg = isPast ? 'bg-gray-100' : (getVDayBg(day) || 'bg-white');
                              return (
                                <td key={di} className={`border-r border-b p-1 text-center ${cellBg}`}>
                                  <span className={`text-[11px] font-black ${isPast ? 'text-gray-400' : numCls}`}>{count > 0 ? count : <span className="text-gray-300">0</span>}</span>
                                </td>
                              );
                            })}
                            {/* 合计格（5列），只高亮对应列 */}
                            <td className="sticky right-0 z-[20] bg-gray-100 border-l border-b" style={{ width: '220px', minWidth: '220px' }}>
                              <div className="flex h-full text-[10px]">
                                {[0, 1, 2, 3, 4].map(ci => (
                                  <div key={ci} className={`flex-1 flex flex-col items-center justify-center py-1 ${ci < 4 ? 'border-r border-gray-200' : ''
                                    } ${ci === colIdx ? (ci === 0 ? 'bg-blue-50' : ci === 1 ? 'bg-indigo-50' : ci === 2 ? 'bg-orange-50' : 'bg-red-50') : ''
                                    }`}>
                                    {ci === colIdx && <><span className={`text-[11px] font-black ${numCls}`}>{total}</span><div className="text-[9px] text-gray-400">合计</div></>}
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tfoot>
                  </table>
                </div>
              )}
              {/* 底部操作栏（表格模式） */}
              {viewingScheduleMode === 'table' && (
                <div className="px-6 py-4 border-t bg-white flex items-start gap-4 flex-wrap">
                  <div className="flex-1 flex flex-col gap-1 min-w-0 text-xs">
                    {rule1Bad.map(name => (
                      <span key={name} className="text-red-600 font-bold">⚠ {name} 存在连续上班 &gt;6 天的情况</span>
                    ))}
                    {rule2Bad.map(name => (
                      <span key={name} className="text-red-600 font-bold">⚠ {name} 存在晚班接早班的情况</span>
                    ))}
                    {rule5Bad.map(({ name, actual, required }) => (
                      <span key={name} className="text-red-600 font-bold">⚠ {name} 的排班天数不正确（实际 {actual} 天 / 应排班 {required} 天）</span>
                    ))}
                    {!hardFail && rule3BadDays.length > 0 && (
                      <span className="text-yellow-600 font-bold">⚠ 早晚班人数可能不均衡，请确认（{rule3BadDays.join('、')}）</span>
                    )}
                    {!hardFail && rule4BadDays.length > 0 && (
                      <span className="text-yellow-600 font-bold">⚠ 当前日期排班人数可能较少，请确认（{rule4BadDays.join('、')}）</span>
                    )}
                    {!hardFail && !softWarn && (
                      <span className="text-green-600 font-bold">✓ 所有规则均满足</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <button onClick={() => setViewingSchedule(null)} className="px-5 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm font-bold hover:bg-gray-100 transition-all">取消</button>
                    <button
                      disabled={hardFail}
                      onClick={() => { if (!hardFail) setViewingConfirmSave(true); }}
                      className={`px-5 py-2 rounded-xl text-sm font-black text-white transition-all ${hardFail ? 'bg-gray-300 cursor-not-allowed opacity-60' : softWarn ? 'bg-yellow-400 hover:bg-yellow-500' : 'bg-green-500 hover:bg-green-600'
                        }`}
                    >保存更改</button>
                  </div>
                </div>
              )}
            </div>
            {/* 二次确认弹窗 */}
            {viewingConfirmSave && (
              <div className="fixed inset-0 z-[600] bg-black/60 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setViewingConfirmSave(false); }}>
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 flex flex-col gap-5">
                  <div className="text-base font-black text-gray-900">确认提交更改吗？</div>
                  <div className="text-sm text-gray-500 leading-relaxed">确认后将覆盖保存至原方案文件。</div>
                  <div className="flex gap-3 justify-end mt-2">
                    <button onClick={() => setViewingConfirmSave(false)} className="px-5 py-2 rounded-xl border border-gray-200 text-gray-600 font-bold text-sm hover:bg-gray-100 transition-all">取消</button>
                    <button onClick={() => {
                      if (!viewingDraft) return;
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

      {/* 删除方案确认弹窗 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[400] bg-black/60 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setShowDeleteConfirm(null); }}>
          <div className="bg-white rounded-[1.5rem] shadow-2xl w-full max-w-sm p-8 flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center mb-1">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" /></svg>
              </div>
              <h3 className="text-lg font-black text-gray-900">确认删除方案？</h3>
              <p className="text-sm text-gray-500">此操作不可撤销，方案将从本地永久删除。</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 py-3 rounded-xl border border-gray-200 font-bold text-gray-700 hover:bg-gray-50 transition-all"
              >
                取消
              </button>
              <button
                onClick={() => {
                  setSavedSchedules(prev => prev.filter(s => s.id !== showDeleteConfirm));
                  if (viewingSchedule?.id === showDeleteConfirm) setViewingSchedule(null);
                  setShowDeleteConfirm(null);
                }}
                className="flex-1 py-3 rounded-xl bg-red-600 text-white font-black hover:bg-red-700 transition-all"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== 发起对调弹窗 ========== */}
      {showSwapModal && boardApplied && (() => {
        const swMonth = new Date(boardApplied.month + '-01');
        const swDays = eachDayOfInterval({ start: startOfMonth(swMonth), end: endOfMonth(swMonth) });
        const eligibleUsers = membersList.filter(m => m.name !== currentUser && m.inSchedule && boardApplied.schedule[m.name]);
        const mySchedule = boardApplied.schedule[currentUser] ?? {};
        const targetSchedule = swapTargetUser ? (boardApplied.schedule[swapTargetUser] ?? {}) : {};
        // 可选日期：两人都有排班且班次不同的日期
        const swappableDayOptions = swapTargetUser ? swDays.map(d => {
          const dn = parseInt(format(d, 'd'));
          const myShift = mySchedule[dn];
          const tarShift = targetSchedule[dn];
          if (!myShift || !tarShift || myShift === tarShift) return null;
          return {
            value: String(dn),
            label: `${dn}日 · 我 · ${myShift}班  ⟷  ${swapTargetUser} · ${tarShift}班`,
            day: dn, myShift, tarShift,
          };
        }).filter(Boolean) as { value: string; label: string; day: number; myShift: string; tarShift: string }[] : [];
        const usedDays = new Set(swapSelectedDays.filter(Boolean));
        const canSubmit = swapTargetUser !== '' && swapSelectedDays.some(d => d !== '') && !swapValidationResult;

        return (
          <div className="fixed inset-0 z-[500] bg-black/70 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setShowSwapModal(false); }}>
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="bg-zinc-900 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ArrowLeftRight size={20} className="text-white" />
                  <h2 className="text-lg font-black text-white">发起对调</h2>
                  <span className="text-xs text-zinc-400 font-medium">{boardApplied.month}</span>
                </div>
                <button onClick={() => setShowSwapModal(false)} className="text-zinc-400 hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 space-y-5">
                {/* 选择对调对象 */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">对调对象</label>
                  <select
                    value={swapTargetUser}
                    onChange={e => {
                      setSwapTargetUser(e.target.value);
                      setSwapSelectedDays(['']);
                      setSwapError(null);
                      setSwapValidationResult(null);
                    }}
                    className="select-compact w-full"
                  >
                    <option value="">请选择对调成员</option>
                    {eligibleUsers.map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
                  </select>
                </div>

                {/* 选择对调日期 */}
                {swapTargetUser && (
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">选择对调班次</label>
                    {swappableDayOptions.length === 0 ? (
                      <div className="text-sm text-gray-400 bg-gray-50 rounded-xl px-4 py-3 border border-dashed border-gray-200">两人没有可对调的班次（所有日期班次相同）</div>
                    ) : (
                      <div className="space-y-3">
                        {swapSelectedDays.map((day, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <div className="flex-1">
                              <select
                                value={day}
                                onChange={e => {
                                  const newDays = [...swapSelectedDays];
                                  newDays[idx] = e.target.value;
                                  setSwapSelectedDays(newDays);
                                  setSwapError(null);
                                  runSwapValidation(newDays, boardApplied, swapTargetUser);
                                }}
                                className="select-compact w-full text-xs"
                              >
                                <option value="">选择对调班次</option>
                                {swappableDayOptions.map(o => (
                                  <option key={o.value} value={o.value} disabled={usedDays.has(o.value) && day !== o.value}>
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
                                  runSwapValidation(newDays, boardApplied, swapTargetUser);
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
                        onClick={() => setSwapSelectedDays(prev => [...prev, ''])}
                        className="mt-3 flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors"
                      >
                        <Plus size={14} /> 添加一组对调
                      </button>
                    )}
                  </div>
                )}

                {/* 校验结果 */}
                {swapValidationResult && (
                  <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                    <span>{swapValidationResult}</span>
                  </div>
                )}
                {swapTargetUser && swapSelectedDays.some(d => d !== '') && !swapValidationResult && (
                  <div className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700">
                    <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                    <span>校验通过，可以提交对调申请。</span>
                  </div>
                )}

                {/* 错误提示 */}
                {swapError && (
                  <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                    <span>{swapError}</span>
                  </div>
                )}

                {/* 操作按钮 */}
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
                    className={`flex-1 py-3 rounded-xl font-black transition-all ${canSubmit ? 'bg-zinc-900 text-white hover:bg-black' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
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

      {/* ========== 对调详情/审批弹窗 ========== */}
      {showSwapDetail && (() => {
        const req = showSwapDetail;
        const isTarget = req.toUser === currentUser;
        const isPending = req.status === '待处理';
        const statusStyle: Record<string, string> = {
          '待处理': 'bg-yellow-100 text-yellow-700 border-yellow-200',
          '已同意': 'bg-green-100 text-green-700 border-green-200',
          '已拒绝': 'bg-red-100 text-red-700 border-red-200',
        };
        return (
          <div className="fixed inset-0 z-[500] bg-black/70 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) { setShowSwapDetail(null); setSwapError(null); } }}>
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
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
                    <span className="font-bold text-gray-900">{req.fromUser}</span> → <span className="font-bold text-gray-900">{req.toUser}</span>
                  </div>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${statusStyle[req.status]}`}>{req.status}</span>
                </div>
                <div className="text-xs text-gray-400">月份: {req.month} · 发起时间: {new Date(req.createdAt).toLocaleString('zh-CN')}</div>
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
                  <div className="text-center text-sm text-gray-400 py-2">等待 {req.toUser} 审批中...</div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* 节假日批量导入弹窗 */}
      {showHolidayImportModal && (
        <div className="fixed inset-0 z-[500] bg-black/60 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) { setShowHolidayImportModal(false); setHolidayImportPreview(null); } }}>
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-xl p-8 flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-green-100 flex items-center justify-center shrink-0">
                <CalendarDays size={18} className="text-green-600" />
              </div>
              <div>
                <div className="text-base font-black text-gray-900">{holidayImportPreview ? '确认新增内容' : '批量新增节假日'}</div>
                <div className="text-xs text-gray-400 mt-0.5">{holidayImportPreview ? `已识别 ${holidayImportPreview.length} 条记录，确认后追加至配置末尾` : '粘贴文本后点击识别，系统自动解析'}</div>
              </div>
            </div>

            {!holidayImportPreview ? (
              <textarea
                value={holidayImportText}
                onChange={e => setHolidayImportText(e.target.value)}
                rows={8}
                placeholder={`请将节假日配置粘贴在此处，系统将自动识别，多个日期请换行粘贴，例：\n2026/02/14 春节  调休上班日  -\n2026/02/15 春节  节假日  -\n2026/02/16 春节  节假日  是`}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-400 resize-none placeholder:text-gray-300 placeholder:leading-relaxed"
              />
            ) : (
              <div className="overflow-auto max-h-72 rounded-xl border border-gray-200">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b text-[11px] font-bold text-gray-500 uppercase tracking-wide">
                      <th className="px-4 py-2.5 text-left">日期</th>
                      <th className="px-4 py-2.5 text-left">名称</th>
                      <th className="px-4 py-2.5 text-center">类型</th>
                      <th className="px-4 py-2.5 text-center">法定</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {holidayImportPreview.map((row, ri) => (
                      <tr key={ri} className="hover:bg-gray-50/40">
                        <td className="px-4 py-2 font-mono text-gray-700">{row.date}</td>
                        <td className="px-4 py-2 font-semibold text-gray-800">{row.name}</td>
                        <td className="px-4 py-2 text-center">
                          <span className={`inline-block text-[11px] font-bold border rounded-full px-2.5 py-0.5 ${row.type === '节假日' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-orange-100 text-orange-700 border-orange-200'
                            }`}>{row.type}</span>
                        </td>
                        <td className="px-4 py-2 text-center">
                          {row.isLegal
                            ? <span className="inline-block bg-green-100 text-green-700 border border-green-200 text-[11px] font-bold rounded-full px-2.5 py-0.5">是</span>
                            : <span className="text-gray-300">&mdash;</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => { setShowHolidayImportModal(false); setHolidayImportPreview(null); setHolidayImportText(''); }}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-all"
              >取消</button>
              {!holidayImportPreview ? (
                <button
                  disabled={!holidayImportText.trim()}
                  onClick={() => {
                    const rows = holidayImportText.split('\n')
                      .map(line => line.trim())
                      .filter(line => line.length > 0)
                      .map(line => {
                        const parts = line.split(/\s+/);
                        const date = parts[0] ?? '';
                        const name = parts[1] ?? '';
                        const type = (parts[2] === '节假日' ? '节假日' : '调休上班日') as '节假日' | '调休上班日';
                        const isLegal = parts[3] === '是';
                        return { date, name, type, isLegal };
                      })
                      .filter(r => /^\d{4}\/\d{2}\/\d{2}$/.test(r.date));
                    setHolidayImportPreview(rows);
                  }}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-green-600 text-white text-sm font-black hover:bg-green-700 transition-all disabled:opacity-40"
                >识别</button>
              ) : (
                <button
                  disabled={holidayImportPreview.length === 0}
                  onClick={async () => {
                    if (!holidayImportPreview || holidayImportPreview.length === 0) return;
                    const updated = [...globalHolidayConfig, ...holidayImportPreview];
                    try {
                      await fetch('/api/config/holidays', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(updated),
                      });
                    } catch (e) { console.error(e); }
                    setGlobalHolidayConfig(updated);
                    setHolidayDraft(updated);
                    setShowHolidayImportModal(false);
                    setHolidayImportPreview(null);
                    setHolidayImportText('');
                  }}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-green-600 text-white text-sm font-black hover:bg-green-700 transition-all disabled:opacity-40"
                >确认新增</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 排班看板编辑-二次确认弹窗 */}
      {boardEditConfirmSave && (
        <div className="fixed inset-0 z-[600] bg-black/60 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setBoardEditConfirmSave(false); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 flex flex-col gap-5">
            <div className="text-base font-black text-gray-900">确认保存排班修改？</div>
            <div className="text-sm text-gray-500 leading-relaxed">确认后将直接覆盖当前已应用的排班方案（{boardMonthKey}），此操作不可撤销。</div>
            <div className="flex gap-3 justify-end mt-2">
              <button onClick={() => setBoardEditConfirmSave(false)} className="px-5 py-2 rounded-xl border border-gray-200 text-gray-600 font-bold text-sm hover:bg-gray-100 transition-all">取消</button>
              <button onClick={() => {
                if (!boardEditDraft || !boardApplied) return;
                // 计算变更 diff
                const diffChanges: { name: string; day: number; fromShift: string; toShift: string }[] = [];
                for (const [name, days] of Object.entries(boardEditDraft)) {
                  const origDays = boardApplied.schedule[name] ?? {};
                  for (const [dn, newShift] of Object.entries(days)) {
                    const fromShift = origDays[parseInt(dn)] ?? '';
                    if (fromShift !== newShift) diffChanges.push({ name, day: parseInt(dn), fromShift, toShift: newShift });
                  }
                }
                if (diffChanges.length > 0) {
                  setBoardEditLogs(prev => [{
                    id: Date.now().toString(),
                    month: boardMonthKey,
                    editor: currentUser,
                    timestamp: new Date().toISOString(),
                    type: 'edit' as const,
                    changes: diffChanges,
                  }, ...prev]);
                }
                setAppliedSchedules(prev => ({
                  ...prev,
                  [boardMonthKey]: { ...boardApplied, schedule: boardEditDraft },
                }));
                setBoardEditConfirmSave(false);
                setBoardEditMode(false);
                setBoardEditDraft(null);
                setBoardEditDropdown(null);
              }} className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-sm transition-all">确认保存</button>
            </div>
          </div>
        </div>
      )}

      {/* 底部状态栏 */}
      <footer className="bg-white border-t py-3 px-6 text-[11px] text-gray-400 flex justify-between items-center">
        <div className="flex gap-6">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> 系统正常
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> 已同步最新飞书数据
          </span>
        </div>
        <div>
          客服排班管理系统 Copyright 2026
        </div>
      </footer>
    </div>
  );
}
