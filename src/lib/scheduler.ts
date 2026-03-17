import { 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isWeekend, 
  format,
  addMonths,
  getDay,
  isSameDay
} from 'date-fns';
import { prisma } from './prisma';

/**
 * 1. 日期分类与排班优先级
 */
export async function getDayCategory(date: Date) {
  // Check if it's a holiday in database
  const holiday = await prisma.holiday.findUnique({
    where: { date: date }
  });

  const isSummerWinterVacation = checkSummerWinterVacation(date);
  const isWeekendDay = isWeekend(date);

  if (isSummerWinterVacation) {
    if (holiday?.type === 'HOLIDAY') return { label: '寒暑假节假日', priority: 1, type: 'PEAK' };
    return { label: '寒暑假其它', priority: 2, type: 'PEAK' };
  } else {
    if (holiday?.type === 'HOLIDAY') return { label: '非寒暑假节假日', priority: 3, type: 'PEAK' };
    if (isWeekendDay && holiday?.type !== 'WORKDAY') return { label: '周末', priority: 4, type: 'SUB-PEAK' };
    
    // Check if it's day before holiday
    const nextDay = new Date(date);
    nextDay.setDate(date.getDate() + 1);
    const nextDayHoliday = await prisma.holiday.findUnique({ where: { date: nextDay } });
    if (nextDayHoliday?.type === 'HOLIDAY') return { label: '假前一天', priority: 5, type: 'NORMAL' };

    return { label: '工作日', priority: 6, type: 'NORMAL' };
  }
}

function checkSummerWinterVacation(date: Date): boolean {
  const month = date.getMonth() + 1; // 0-indexed
  const day = date.getDate();
  // Simplified winter/summer vacation: Feb (Winter), July-Aug (Summer)
  if (month === 2) return true;
  if (month === 7 || month === 8) return true;
  return false;
}

/**
 * 2. 自动预填最低人力与天数精算 (Phase 1)
 */
export async function initializeNextMonth(yearMonth: string) {
  const [year, month] = yearMonth.split('-').map(Number);
  const startDate = startOfMonth(new Date(year, month - 1));
  const endDate = endOfMonth(startDate);
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const settings = await prisma.setting.findUnique({ where: { id: 'standard' } });
  const weekdayMin = settings?.weekdayMinNum ?? 1;
  const weekendMin = settings?.weekendMinNum ?? 2;

  // Calculate required days per user
  const users = await prisma.user.findMany({ where: { isActive: true } });
  
  // Get holidays and adjusted workdays for this month
  const holidays = await prisma.holiday.findMany({
    where: {
      date: { gte: startDate, lte: endDate }
    }
  });

  const workdayCount = days.filter(d => {
    const holiday = holidays.find(h => isSameDay(h.date, d));
    if (holiday) return holiday.type === 'WORKDAY';
    return !isWeekend(d);
  }).length;

  const holidayCount = holidays.filter(h => h.type === 'HOLIDAY').length;

  for (const user of users) {
    const leaveDays = await prisma.leaveDay.count({
      where: {
        userId: user.id,
        date: { gte: startDate, lte: endDate }
      }
    });

    const requiredDays = workdayCount + holidayCount - leaveDays;
    
    await prisma.monthlyRule.upsert({
      where: { month_userId: { month: yearMonth, userId: user.id } },
      update: { requiredDays, confirmedDays: requiredDays },
      create: { month: yearMonth, userId: user.id, requiredDays, confirmedDays: requiredDays }
    });
  }

  // Trigger Feishu Notification (Mock)
  await notifyManagers(yearMonth);
}

async function notifyManagers(month: string) {
  console.log(`[Feishu] Notification sent to managers for ${month} initialization.`);
}

/**
 * 3. 随机抽签 (Phase 4)
 */
export async function performDraw(date: Date) {
  const wishes = await prisma.wishDay.findMany({
    where: { date },
    include: { user: true }
  });

  const settings = await prisma.setting.findUnique({ where: { id: 'standard' } });
  const isWeekendDay = isWeekend(date);
  const minStaff = isWeekendDay ? (settings?.weekendMinNum ?? 2) : (settings?.weekdayMinNum ?? 1);
  
  const totalUsers = await prisma.user.count({ where: { isActive: true } });
  const maxAllowLeave = totalUsers - minStaff;

  if (wishes.length > maxAllowLeave) {
    // Shuffle and pick losers
    const shuffled = wishes.sort(() => Math.random() - 0.5);
    const losers = shuffled.slice(maxAllowLeave);
    
    // Notify losers
    for (const loser of losers) {
      await notifyUserRedraw(loser.userId, date);
      // Delete the wish or mark it as rejected
      await prisma.wishDay.delete({ where: { id: loser.id } });
    }
  }
}

async function notifyUserRedraw(userId: string, date: Date) {
  console.log(`[Feishu] Notification sent to user ${userId}: Wish for ${format(date, 'yyyy-MM-dd')} was rejected. Please pick another day.`);
}
