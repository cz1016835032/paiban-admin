export type HolidayRow = { date: string; name: string; type: '节假日' | '调休上班日'; isLegal: boolean };

export const DEFAULT_HOLIDAY_CONFIG: HolidayRow[] = [
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

export const DEFAULT_MIN_STAFF: Record<string, number> = {
  '普通工作日': 2, '假前一日': 2, '周末': 1, '调休工作日': 1, '法定节假日': 1,
};

export type MemberItem = { id: number; adminUserId: number; name: string; role: string; status: number; inSchedule: number };
export type LocalMember = { id: number; name: string; role: string; status: string; inSchedule: boolean };

export type BoardEditLog = {
  id: string;
  month: string;
  editor: string;
  timestamp: string;
  type: 'edit' | 'apply_new' | 'apply_overwrite' | 'swap_request' | 'swap_approve' | 'swap_reject';
  changes?: { name: string; day: number; fromShift: string; toShift: string }[];
  planName?: string;
  swapFrom?: string;
  swapTo?: string;
  swapPairs?: { fromDay: number; fromShift: string; toDay: number; toShift: string }[];
};

export type SavedSchedule = {
  id: string;
  planName: string;
  month: string;
  schedule: Record<string, Record<number, '早' | '晚' | '休' | '假'>>;
};

export type SwapPair = {
  fromDay: number;
  fromShift: '早' | '晚' | '休' | '假';
  toDay: number;
  toShift: '早' | '晚' | '休' | '假';
};

export type SwapRequest = {
  id: string;
  fromUser: string;
  toUser: string;
  month: string;
  swaps: SwapPair[];
  status: '待处理' | '已同意' | '已拒绝';
  createdAt: string;
};
