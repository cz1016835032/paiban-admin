import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';

type HolidayRow = {
  date: string;
  name: string;
  type: '节假日' | '调休上班日';
  isLegal: boolean;
};

type MemberHolidayMap = Record<string, number>;

async function getHolidayRows() {
  const holidayLog = await prisma.auditLog.findFirst({
    where: { action: 'HOLIDAY_CONFIG' },
    orderBy: { createdAt: 'desc' },
  });
  return holidayLog ? (JSON.parse(holidayLog.details) as HolidayRow[]) : [];
}

function getLegalHolidayCountByMonth(month: string, rows: HolidayRow[]) {
  const [y, m] = month.split('-').map(Number);
  const monthStart = startOfMonth(new Date(y, m - 1, 1));
  const monthEnd = endOfMonth(monthStart);
  const monthDays = new Set(eachDayOfInterval({ start: monthStart, end: monthEnd }).map(d => format(d, 'yyyy/MM/dd')));

  return rows.filter(r => r.type === '节假日' && r.isLegal && monthDays.has(r.date)).length;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const month = url.searchParams.get('month');
    if (!month) {
      return NextResponse.json({ error: '缺少 month 参数' }, { status: 400 });
    }

    const action = `MEMBER_HOLIDAY_OVERRIDE:${month}`;
    const [log, holidays] = await Promise.all([
      prisma.auditLog.findFirst({ where: { action }, orderBy: { createdAt: 'desc' } }),
      getHolidayRows(),
    ]);

    const data = log ? (JSON.parse(log.details) as MemberHolidayMap) : {};
    const legalHolidayCount = getLegalHolidayCountByMonth(month, holidays);

    return NextResponse.json({ data, legalHolidayCount });
  } catch (error) {
    console.error('GET /api/config/member-holiday error:', error);
    return NextResponse.json({ error: '读取法定节假日排班失败' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const month = body?.month as string | undefined;
    const name = body?.name as string | undefined;
    const days = body?.days as number | undefined;

    if (!month || !name || typeof days !== 'number') {
      return NextResponse.json({ error: '参数不完整' }, { status: 400 });
    }

    const action = `MEMBER_HOLIDAY_OVERRIDE:${month}`;
    const [old, holidays] = await Promise.all([
      prisma.auditLog.findFirst({ where: { action }, orderBy: { createdAt: 'desc' } }),
      getHolidayRows(),
    ]);
    const legalHolidayCount = getLegalHolidayCountByMonth(month, holidays);
    const prevMap = old ? (JSON.parse(old.details) as MemberHolidayMap) : {};
    const nextMap = { ...prevMap, [name]: Math.max(0, Math.min(legalHolidayCount, days)) };

    await prisma.auditLog.create({
      data: {
        actorId: 'system',
        action,
        details: JSON.stringify(nextMap),
      },
    });

    return NextResponse.json({ success: true, data: nextMap });
  } catch (error) {
    console.error('PUT /api/config/member-holiday error:', error);
    return NextResponse.json({ error: '保存法定节假日排班失败' }, { status: 500 });
  }
}
