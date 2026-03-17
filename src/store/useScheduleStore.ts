import { create } from 'zustand';
import {
  DEFAULT_HOLIDAY_CONFIG,
  DEFAULT_MIN_STAFF,
  HolidayRow,
  MemberItem,
  LocalMember,
  BoardEditLog,
  SavedSchedule,
  SwapRequest,
} from '@/types/schedule';

interface ScheduleStore {
  // ── 日期导航 ─────────────────────────────
  currentDate: Date;
  setCurrentDate: (d: Date) => void;

  // ── 用户 & 成员 ─────────────────────────
  members: MemberItem[];
  setMembers: (m: MemberItem[]) => void;
  currentUser: string;
  setCurrentUser: (u: string) => void;
  membersList: LocalMember[];
  setMembersList: (m: LocalMember[]) => void;

  // ── 统计数据 ────────────────────────────
  data: unknown;
  setData: (d: unknown) => void;
  loading: boolean;
  setLoading: (v: boolean) => void;

  // ── 后端排班明细缓存 ────────────────────
  dbBoardData: { name: string; schedules: { day: number; shift: string }[] }[] | null;
  setDbBoardData: (d: ScheduleStore['dbBoardData']) => void;

  // ── 已应用 & 已保存排班方案 ──────────────
  appliedSchedules: Record<string, SavedSchedule>;
  setAppliedSchedules: (fn: (prev: Record<string, SavedSchedule>) => Record<string, SavedSchedule>) => void;
  savedSchedules: SavedSchedule[];
  setSavedSchedules: (fn: (prev: SavedSchedule[]) => SavedSchedule[]) => void;

  // ── 排班调整日志 ─────────────────────────
  boardEditLogs: BoardEditLog[];
  setBoardEditLogs: (fn: (prev: BoardEditLog[]) => BoardEditLog[]) => void;

  // ── 全局节假日 & 最小排班配置 ─────────────
  globalHolidayConfig: HolidayRow[];
  setGlobalHolidayConfig: (c: HolidayRow[]) => void;
  minStaffConfig: Record<string, number>;
  setMinStaffConfig: (c: Record<string, number>) => void;

  // ── 休息意愿（已提交） ───────────────────
  submittedLeaveData: Record<string, Record<string, '轮休' | '请假'>>;
  setSubmittedLeaveData: (fn: (prev: Record<string, Record<string, '轮休' | '请假'>>) => Record<string, Record<string, '轮休' | '请假'>>) => void;

  // ── 预填开放控制 ─────────────────────────
  prefillOpenMap: Record<string, boolean>;
  setPrefillOpenMap: (fn: (prev: Record<string, boolean>) => Record<string, boolean>) => void;

  // ── 每日最低人数覆盖（排班计算 & 对调校验共用） ──
  calcDayMinStaffOverrides: Record<string, number>;
  setCalcDayMinStaffOverrides: (fn: (prev: Record<string, number>) => Record<string, number>) => void;

  // ── 成员法定节假日出勤天数 ────────────────
  memberHolidayDays: Record<string, number>;
  setMemberHolidayDays: (m: Record<string, number>) => void;

  // ── 对调申请 ─────────────────────────────
  swapRequests: SwapRequest[];
  setSwapRequests: (fn: (prev: SwapRequest[]) => SwapRequest[]) => void;
}

export const useScheduleStore = create<ScheduleStore>((set) => ({
  currentDate: new Date(2026, 2, 5),
  setCurrentDate: (d) => set({ currentDate: d }),

  members: [],
  setMembers: (m) => set({ members: m }),
  currentUser: '',
  setCurrentUser: (u) => set({ currentUser: u }),
  membersList: [],
  setMembersList: (m) => set({ membersList: m }),

  data: null,
  setData: (d) => set({ data: d }),
  loading: true,
  setLoading: (v) => set({ loading: v }),

  dbBoardData: null,
  setDbBoardData: (d) => set({ dbBoardData: d }),

  appliedSchedules: {},
  setAppliedSchedules: (fn) =>
    set((s) => {
      const next = fn(s.appliedSchedules);
      return { appliedSchedules: next };
    }),

  savedSchedules: [],
  setSavedSchedules: (fn) =>
    set((s) => {
      const next = fn(s.savedSchedules);
      return { savedSchedules: next };
    }),

  boardEditLogs: [],
  setBoardEditLogs: (fn) =>
    set((s) => {
      const next = fn(s.boardEditLogs);
      return { boardEditLogs: next };
    }),

  globalHolidayConfig: DEFAULT_HOLIDAY_CONFIG,
  setGlobalHolidayConfig: (c) => set({ globalHolidayConfig: c }),

  minStaffConfig: DEFAULT_MIN_STAFF,
  setMinStaffConfig: (c) => set({ minStaffConfig: c }),

  submittedLeaveData: {},
  setSubmittedLeaveData: (fn) =>
    set((s) => {
      const next = fn(s.submittedLeaveData);
      return { submittedLeaveData: next };
    }),

  prefillOpenMap: {},
  setPrefillOpenMap: (fn) =>
    set((s) => {
      const next = fn(s.prefillOpenMap);
      return { prefillOpenMap: next };
    }),

  calcDayMinStaffOverrides: {},
  setCalcDayMinStaffOverrides: (fn) =>
    set((s) => {
      const next = fn(s.calcDayMinStaffOverrides);
      return { calcDayMinStaffOverrides: next };
    }),

  memberHolidayDays: {},
  setMemberHolidayDays: (m) => set({ memberHolidayDays: m }),

  swapRequests: [],
  setSwapRequests: (fn) =>
    set((s) => {
      const next = fn(s.swapRequests);
      return { swapRequests: next };
    }),
}));
