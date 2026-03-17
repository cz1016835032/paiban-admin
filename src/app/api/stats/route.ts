import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { startOfMonth, endOfMonth, eachDayOfInterval, isWeekend, isSameDay } from 'date-fns';

export async function GET() {
  try {
    const today = new Date();
    const startDate = startOfMonth(today);
    const endDate = endOfMonth(today);
    const days = eachDayOfInterval({ start: startDate, end: endDate });

    // 1. 获取基础配置
    const settings = await prisma.setting.findUnique({ where: { id: 'standard' } });
    
    // 2. 获取用户和排班统计
    const totalUsers = await prisma.user.count({ where: { isActive: true } });
    const schedules = await prisma.schedule.findMany({
      where: {
        date: { gte: startDate, lte: endDate }
      }
    });

    // 3. 构建日历数据
    const calendarData = days.map(d => {
      const isWeekendDay = isWeekend(d);
      const minStaff = isWeekendDay ? (settings?.weekendMinNum ?? 4) : (settings?.weekdayMinNum ?? 2);
      const actualStaff = schedules.filter(s => isSameDay(new Date(s.date), d)).length;
      
      return {
        day: d.getDate(),
        isPeak: isWeekendDay,
        minStaff,
        actualStaff
      };
    });

    // 4. 获取待处理事项 (示例：意愿采集超标)
    const wishes = await prisma.wishDay.findMany({
      where: { date: { gte: startDate, lte: endDate } }
    });
    
    // 按日期分组统计
    const wishCounts: Record<string, number> = {};
    wishes.forEach(w => {
      const key = w.date.toISOString().split('T')[0];
      wishCounts[key] = (wishCounts[key] || 0) + 1;
    });

    const alerts = Object.entries(wishCounts)
      .filter(([date, count]) => {
        const d = new Date(date);
        const minStaff = isWeekend(d) ? (settings?.weekendMinNum ?? 4) : (settings?.weekdayMinNum ?? 2);
        return count > (totalUsers - minStaff); // 超标
      })
      .map(([date, count]) => ({
        date,
        count,
        limit: totalUsers - (isWeekend(new Date(date)) ? (settings?.weekendMinNum ?? 4) : (settings?.weekdayMinNum ?? 2))
      }));

    return NextResponse.json({
      calendarData,
      alerts,
      settings: {
        weekdayMinNum: settings?.weekdayMinNum ?? 2,
        weekendMinNum: settings?.weekendMinNum ?? 4
      }
    });
  } catch (error) {
    console.error('Stats API Error:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
