import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type MinStaffConfig = {
  normalWorkday: number;
  preHolidayDay: number;
  weekend: number;
  makeupWorkday: number;
  legalHoliday: number;
};

type HolidayRow = {
  date: string;
  name: string;
  type: '节假日' | '调休上班日';
  isLegal: boolean;
};

const defaultMinStaff: MinStaffConfig = {
  normalWorkday: 2,
  preHolidayDay: 2,
  weekend: 1,
  makeupWorkday: 1,
  legalHoliday: 1,
};

export async function GET() {
  try {
    const [minStaffLog, holidayLog] = await Promise.all([
      prisma.auditLog.findFirst({ where: { action: 'MIN_STAFF_CONFIG' }, orderBy: { createdAt: 'desc' } }),
      prisma.auditLog.findFirst({ where: { action: 'HOLIDAY_CONFIG' }, orderBy: { createdAt: 'desc' } }),
    ]);

    const minStaff = minStaffLog ? (JSON.parse(minStaffLog.details) as MinStaffConfig) : defaultMinStaff;
    const holidays = holidayLog ? (JSON.parse(holidayLog.details) as HolidayRow[]) : [];

    return NextResponse.json({ minStaff, holidays });
  } catch (error) {
    console.error('GET /api/config error:', error);
    return NextResponse.json({ error: '读取配置失败' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const minStaff = body?.minStaff as MinStaffConfig | undefined;
    const holidays = body?.holidays as HolidayRow[] | undefined;

    if (minStaff) {
      await prisma.auditLog.create({
        data: {
          actorId: 'system',
          action: 'MIN_STAFF_CONFIG',
          details: JSON.stringify(minStaff),
        },
      });
    }

    if (holidays) {
      await prisma.auditLog.create({
        data: {
          actorId: 'system',
          action: 'HOLIDAY_CONFIG',
          details: JSON.stringify(holidays),
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PUT /api/config error:', error);
    return NextResponse.json({ error: '保存配置失败' }, { status: 500 });
  }
}
