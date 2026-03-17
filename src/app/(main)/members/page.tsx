'use client';

import React, { useState } from 'react';
import { CheckCircle2, Users } from 'lucide-react';
import { useScheduleStore } from '@/store/useScheduleStore';
import { paibanFetch } from '@/lib/paiban';
import type { MemberItem } from '@/types/schedule';

const ROLE_OPTIONS = ['租号客服', '卖号客服', '管理员'] as const;
type Role = typeof ROLE_OPTIONS[number];

export default function MembersPage() {
  const { members, setMembers } = useScheduleStore();

  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [addMemberName, setAddMemberName] = useState('');
  const [addMemberRole, setAddMemberRole] = useState<Role>('租号客服');

  const [showEditMemberModal, setShowEditMemberModal] = useState(false);
  const [editMemberIdx, setEditMemberIdx] = useState<number | null>(null);
  const [editMemberName, setEditMemberName] = useState('');
  const [editMemberRole, setEditMemberRole] = useState<Role>('租号客服');

  const refetchMembers = () =>
    paibanFetch('/api/paiban/member/list')
      .then(r => r.json())
      .then((res2: { code: string; data: MemberItem[] }) => {
        if (res2.code === '0') setMembers(res2.data);
      });

  const handleToggleInSchedule = async (m: MemberItem) => {
    await paibanFetch('/api/paiban/member/inSchedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: m.id, inSchedule: m.inSchedule === 1 ? 0 : 1 }),
    });
    await refetchMembers();
  };

  const handleAdd = async () => {
    if (!addMemberName.trim()) return;
    await paibanFetch('/api/paiban/member/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminUserId: 0, name: addMemberName.trim(), role: addMemberRole }),
    });
    setShowAddMemberModal(false);
    setAddMemberName('');
    setAddMemberRole('租号客服');
    await refetchMembers();
  };

  const handleEdit = async () => {
    if (editMemberIdx === null || !editMemberName.trim()) return;
    const m = members[editMemberIdx];
    await paibanFetch('/api/paiban/member/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: m.id, name: editMemberName.trim(), role: editMemberRole }),
    });
    setShowEditMemberModal(false);
    await refetchMembers();
  };

  const handleRemove = async (m: MemberItem) => {
    if (!confirm(`确认移除成员「${m.name}」？`)) return;
    await paibanFetch('/api/paiban/member/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: m.id }),
    });
    await refetchMembers();
  };

  return (
    <div className="max-w-[1200px] mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4">
      {/* 页头 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
            <span className="bg-zinc-900 text-white p-2 rounded-2xl"><Users size={24} /></span>
            成员管理
          </h1>
          <p className="text-sm text-gray-400 mt-1 font-medium">管理参与排班的客服成员</p>
        </div>
        <button
          onClick={() => { setAddMemberName(''); setAddMemberRole('租号客服'); setShowAddMemberModal(true); }}
          className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-zinc-900 text-white font-black text-sm hover:bg-black transition-all shadow-xl shadow-zinc-200"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" /></svg>
          添加客服
        </button>
      </div>

      {/* 成员表格 */}
      <div className="bg-white rounded-[2rem] border shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b text-xs font-bold text-gray-500 uppercase tracking-wide">
                <th className="px-6 py-3 text-left">姓名</th>
                <th className="px-4 py-3 text-center">岗位</th>
                <th className="px-4 py-3 text-center">状态</th>
                <th className="px-4 py-3 text-center">参与排班</th>
                <th className="px-6 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {members.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center text-gray-400">
                    <Users size={36} className="mx-auto mb-3 opacity-30" />
                    暂无成员，点击右上角添加
                  </td>
                </tr>
              ) : members.map((m, i) => (
                <tr key={m.id} className="hover:bg-gray-50/40 transition-all">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-zinc-900 text-white flex items-center justify-center font-black text-sm">{m.name[0]}</div>
                      <span className="font-bold text-gray-900">{m.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className="text-xs font-bold text-gray-600 bg-gray-100 px-3 py-1.5 rounded-full">{m.role}</span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${m.status === 1 ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                      {m.status === 1 ? '在职' : '离职'}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <button
                      onClick={() => handleToggleInSchedule(m)}
                      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none ${m.inSchedule === 1 ? 'bg-green-500' : 'bg-gray-200'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${m.inSchedule === 1 ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => {
                          setEditMemberIdx(i);
                          setEditMemberName(m.name);
                          setEditMemberRole(m.role as Role);
                          setShowEditMemberModal(true);
                        }}
                        className="px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-all"
                      >修改</button>
                      <button
                        onClick={() => handleRemove(m)}
                        className="px-3 py-1.5 rounded-xl border border-red-200 bg-red-50 text-xs font-bold text-red-600 hover:bg-red-100 transition-all"
                      >移除</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 添加成员弹窗 */}
      {showAddMemberModal && (
        <div className="fixed inset-0 z-[300] bg-black/60 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setShowAddMemberModal(false); }}>
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm p-8 space-y-5">
            <h3 className="text-xl font-black text-gray-900">添加成员</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1 block">姓名 <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={addMemberName}
                  onChange={e => setAddMemberName(e.target.value)}
                  placeholder="请输入姓名"
                  autoFocus
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1 block">岗位</label>
                <select
                  value={addMemberRole}
                  onChange={e => setAddMemberRole(e.target.value as Role)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900"
                >
                  {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowAddMemberModal(false)} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-all">取消</button>
              <button onClick={handleAdd} disabled={!addMemberName.trim()} className="flex-1 px-4 py-2.5 rounded-xl bg-zinc-900 text-white text-sm font-bold hover:bg-black transition-all disabled:opacity-40">确认添加</button>
            </div>
          </div>
        </div>
      )}

      {/* 编辑成员弹窗 */}
      {showEditMemberModal && editMemberIdx !== null && (
        <div className="fixed inset-0 z-[300] bg-black/60 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setShowEditMemberModal(false); }}>
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm p-8 space-y-5">
            <h3 className="text-xl font-black text-gray-900">修改成员信息</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1 block">姓名 <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={editMemberName}
                  onChange={e => setEditMemberName(e.target.value)}
                  autoFocus
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1 block">岗位</label>
                <select
                  value={editMemberRole}
                  onChange={e => setEditMemberRole(e.target.value as Role)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900"
                >
                  {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowEditMemberModal(false)} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-all">取消</button>
              <button onClick={handleEdit} disabled={!editMemberName.trim()} className="flex-1 px-4 py-2.5 rounded-xl bg-zinc-900 text-white text-sm font-bold hover:bg-black transition-all disabled:opacity-40">保存更改</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
