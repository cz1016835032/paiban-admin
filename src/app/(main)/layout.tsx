'use client';
import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Calendar as CalendarIcon,
  RefreshCw,
  Cpu,
  Users,
  Settings,
} from 'lucide-react';
import { useScheduleStore } from '@/store/useScheduleStore';
import { paibanFetch } from '@/lib/paiban';
import { HolidayRow } from '@/types/schedule';

function NavLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const {
    currentUser,
    membersList,
    members,
    setMembers,
    setCurrentUser,
    setMembersList,
    setMinStaffConfig,
    setGlobalHolidayConfig,
    setLoading,
    setData,
    setPrefillOpenMap,
    setSubmittedLeaveData,
  } = useScheduleStore();

  const isAdmin = membersList.find((m) => m.name === currentUser)?.role === '管理员';

  useEffect(() => {
    // 读取 work-admin 跳转时传入的 satoken URL 参数，存入 sessionStorage
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('satoken');
    if (urlToken) {
      sessionStorage.setItem('paiban_satoken', urlToken);
      window.history.replaceState({}, '', window.location.pathname);
    }

    // 拉取统计数据
    setLoading(true);
    paibanFetch('/api/stats')
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));

    // 最小排班配置（从后端读取）
    paibanFetch('/api/paiban/config/min-staff')
      .then((r) => r.json())
      .then((res) => {
        if (res.code === '0' && res.data) {
          setMinStaffConfig(res.data as Record<string, number>);
        }
      })
      .catch(() => {});

    // 节假日配置
    paibanFetch('/api/paiban/holiday/list')
      .then((r) => r.json())
      .then((res) => {
        if (res.code === '0' && Array.isArray(res.data)) {
          const rows: HolidayRow[] = res.data.map(
            (r: { date: string; name: string; type: number; isLegal: number }) => ({
              date: r.date.replace(/-/g, '/'),
              name: r.name,
              type: r.type === 2 ? '调休上班日' : '节假日',
              isLegal: r.isLegal === 1,
            })
          );
          setGlobalHolidayConfig(rows);
        }
      })
      .catch(() => {});

    // 当前登录用户
    paibanFetch('/api/paiban/member/info')
      .then((r) => r.json())
      .then((res) => {
        if (res.code === '0' && res.data) {
          setCurrentUser(res.data.name || '');
        }
      })
      .catch(() => {});

    // 当前用户最近3个月的预填意愿（预热 store，避免 leave-request 首屏闪烁）
    const now = new Date();
    [1, 2, 3].forEach((offset) => {
      const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      paibanFetch(`/api/paiban/leave-wish/mine?month=${ym}`)
        .then((r) => r.json())
        .then((res) => {
          if (res.code === '0' && res.data && Object.keys(res.data).length > 0) {
            setSubmittedLeaveData((prev) => ({ ...prev, [ym]: res.data }));
          }
        })
        .catch(() => {});
    });

    // 排班成员列表
    paibanFetch('/api/paiban/member/list')
      .then((r) => r.json())
      .then((res) => {
        if (res.code === '0' && Array.isArray(res.data)) {
          setMembers(res.data);
        }
      })
      .catch(() => {});

    // 预填开放状态（后端持久化）
    paibanFetch('/api/paiban/prefill/status')
      .then((r) => r.json())
      .then((res) => {
        if (res.code === '0' && res.data && typeof res.data === 'object') {
          setPrefillOpenMap(() => res.data as Record<string, boolean>);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // members 加载后同步到 membersList
  useEffect(() => {
    if (members.length > 0) {
      const validRoles = ['租号客服', '卖号客服', '管理员'];
      setMembersList(
        members.map((m) => ({
          id: m.id,
          name: m.name,
          role: validRoles.includes(m.role) ? m.role : '租号客服',
          status: m.status === 1 ? '在职' : '离职',
          inSchedule: m.inSchedule === 1,
        }))
      );
    }
  }, [members, setMembersList]);

  const tabs = [
    { href: '/calendar', label: '排班看板', icon: CalendarIcon },
    { href: '/leave-request', label: '休息日预填', icon: RefreshCw },
    ...(isAdmin
      ? [
          { href: '/schedule-calc', label: '排班计算', icon: Cpu },
          { href: '/members', label: '成员管理', icon: Users },
          { href: '/settings', label: '全局配置', icon: Settings },
        ]
      : []),
  ];

  const activeHref = tabs.find((t) => pathname.startsWith(t.href))?.href ?? '/calendar';

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex flex-col">
      {/* 顶部导航栏 */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <div className="bg-blue-600 p-1.5 rounded-lg">
                <CalendarIcon className="text-white" size={20} />
              </div>
              <span className="text-lg font-black tracking-tighter text-gray-900">
                客服排班系统 V2
              </span>
            </div>

            <nav className="flex gap-1 bg-gray-100 p-1 rounded-xl">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = pathname === tab.href || pathname.startsWith(tab.href + '/');
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                      isActive
                        ? 'bg-white text-blue-600 shadow-sm ring-1 ring-gray-200'
                        : 'text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    <Icon size={16} />
                    {tab.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      {/* 主内容 */}
      <main className="flex-1 p-6 max-w-[1600px] mx-auto w-full">{children}</main>

      {/* 底部状态栏 */}
      <footer className="bg-white border-t py-3 px-6 text-[11px] text-gray-400 flex justify-between items-center">
        <div className="flex gap-6">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> 系统正常
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> 已同步最新飞书数据
          </span>
        </div>
        <div />
      </footer>
    </div>
  );
}

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return <NavLayout>{children}</NavLayout>;
}
