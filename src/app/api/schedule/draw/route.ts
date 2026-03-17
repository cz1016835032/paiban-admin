import { NextResponse } from 'next/server';
import { performDraw } from '@/lib/scheduler';

/**
 * 第四阶段：随机抽签处理
 * 路径: /api/schedule/draw
 */
export async function POST(req: Request) {
  try {
    const { date } = await req.json(); // 例如 "2026-03-23"
    
    if (!date) {
      return NextResponse.json({ error: '请提供抽签日期' }, { status: 400 });
    }

    const targetDate = new Date(date);
    
    // 执行抽签逻辑
    // 自动随机抽取落选人员并发送飞书重选通知
    await performDraw(targetDate);

    return NextResponse.json({ 
      success: true, 
      message: `${date} 抽签已完成。落选人已收到重选通知。` 
    });
  } catch (error) {
    console.error('Drawing Error:', error);
    return NextResponse.json({ error: '随机抽签执行报错' }, { status: 500 });
  }
}
