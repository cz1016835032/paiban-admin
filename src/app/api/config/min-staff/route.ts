import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

const ACTION = 'min-staff-config';

const DEFAULTS: Record<string, number> = {
  '普通工作日': 2,
  '假前一日': 2,
  '周末': 1,
  '调休工作日': 1,
  '法定节假日': 1,
};

export async function GET() {
  try {
    const log = await prisma.auditLog.findFirst({
      where: { action: ACTION },
      orderBy: { createdAt: 'desc' },
    });
    const data = log ? JSON.parse(log.details) : DEFAULTS;
    return NextResponse.json({ ...DEFAULTS, ...data });
  } catch {
    return NextResponse.json(DEFAULTS);
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    await prisma.auditLog.create({
      data: { actorId: 'admin', action: ACTION, details: JSON.stringify(body) },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
