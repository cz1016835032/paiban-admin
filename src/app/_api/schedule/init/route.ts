import { NextResponse } from 'next/server';
import { initializeNextMonth } from '@/lib/scheduler';

/**
 * 第一阶段：初始化下月排班规则
 * 路径: /api/schedule/init
 */
export async function POST(req: Request) {
  try {
    const { month } = await req.json(); // 例如 "2026-04"
    
    if (!month) {
      return NextResponse.json({ error: '请提供目标月份，格式如 YYYY-MM' }, { status: 400 });
    }

    // 调用 scheduler.ts 中的初始化逻辑
    // 包含：识别周末/节假日、精算应排班天数 (工作日+加班日-请假)
    await initializeNextMonth(month);

    return NextResponse.json({ 
      success: true, 
      message: `${month} 初始化成功，应排天数已根据日历精算。` 
    });
  } catch (error) {
    console.error('Initialization Error:', error);
    return NextResponse.json({ error: '初始化失败' }, { status: 500 });
  }
}
