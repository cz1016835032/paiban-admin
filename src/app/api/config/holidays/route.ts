import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

const ACTION = 'holiday-config';

const DEFAULTS = [
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

export async function GET() {
  try {
    const log = await prisma.auditLog.findFirst({
      where: { action: ACTION },
      orderBy: { createdAt: 'desc' },
    });
    const data = log ? JSON.parse(log.details) : DEFAULTS;
    return NextResponse.json(data);
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
