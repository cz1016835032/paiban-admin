'use client';

import React, { useState } from 'react';
import { Settings, CheckCircle2 } from 'lucide-react';
import { useScheduleStore } from '@/store/useScheduleStore';
import { paibanFetch } from '@/lib/paiban';
import type { HolidayRow } from '@/types/schedule';

const MIN_STAFF_KEYS = ['普通工作日', '假前一日', '周末', '调休工作日', '法定节假日'] as const;

export default function SettingsPage() {
  const { globalHolidayConfig, setGlobalHolidayConfig, minStaffConfig, setMinStaffConfig } = useScheduleStore();

  const [editingMinStaff, setEditingMinStaff] = useState(false);
  const [minStaffDraft, setMinStaffDraft] = useState<Record<string, number>>({});

  const [editingHoliday, setEditingHoliday] = useState(false);
  const [holidayDraft, setHolidayDraft] = useState<HolidayRow[]>([]);

  const [showHolidayImportModal, setShowHolidayImportModal] = useState(false);
  const [holidayImportText, setHolidayImportText] = useState('');
  const [holidayImportPreview, setHolidayImportPreview] = useState<HolidayRow[] | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSaveMinStaff = async () => {
    setSaving(true);
    try {
      await paibanFetch('/api/paiban/config/min-staff', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(minStaffDraft),
      });
    } catch { /* 保存失败不阻断本地更新 */ } finally {
      setSaving(false);
    }
    setMinStaffConfig({ ...minStaffDraft });
    setEditingMinStaff(false);
  };

  const handleSaveHoliday = async () => {
    setSaving(true);
    try {
      await paibanFetch('/api/paiban/holiday/save', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(holidayDraft),
      });
    } catch { /* 保存失败不阻断本地更新 */ } finally {
      setSaving(false);
    }
    setGlobalHolidayConfig([...holidayDraft]);
    setEditingHoliday(false);
  };

  const parseHolidayImport = (text: string): HolidayRow[] => {
    const lines = text.trim().split('\n').filter(l => l.trim());
    const result: HolidayRow[] = [];
    for (const line of lines) {
      const parts = line.split(/[\t,，\s]+/).filter(Boolean);
      if (parts.length < 3) continue;
      const [date, name, typeRaw] = parts;
      const isAdjust = typeRaw.includes('调休') || typeRaw.includes('补班');
      const type: HolidayRow['type'] = isAdjust ? '调休上班日' : '节假日';
      const isLegal = !isAdjust;
      result.push({ date: date.replace(/\//g, '/'), name, type, isLegal });
    }
    return result;
  };

  return (
    <div className="max-w-[1200px] mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4">
      {/* 页头 */}
      <div>
        <h1 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
          <span className="bg-zinc-900 text-white p-2 rounded-2xl"><Settings size={24} /></span>
          全局配置
        </h1>
        <p className="text-sm text-gray-400 mt-1 font-medium">配置每日最低排班人数与节假日信息</p>
      </div>

      {/* 最低排班人数 */}
      <div className="bg-white rounded-[2rem] border shadow-xl overflow-hidden">
        <div className="px-8 py-5 border-b bg-gray-50/80 flex items-center gap-3">
          <Settings size={18} className="text-zinc-500" />
          <h2 className="text-base font-black text-gray-900 tracking-tight">每日最低排班人数</h2>
          <div className="ml-auto">
            {editingMinStaff ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditingMinStaff(false)}
                  className="px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 transition-all"
                >取消</button>
                <button
                  onClick={handleSaveMinStaff}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 text-white text-xs font-bold hover:bg-black transition-all disabled:opacity-50"
                ><CheckCircle2 size={13} /> {saving ? '保存中…' : '保存配置'}</button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setMinStaffDraft({ ...minStaffConfig });
                  setEditingMinStaff(true);
                }}
                className="px-3 py-1.5 rounded-xl border border-gray-200 bg-white text-xs font-bold text-gray-700 hover:bg-gray-50 transition-all"
              >编辑</button>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b text-xs font-bold text-gray-500 uppercase tracking-wide">
                {MIN_STAFF_KEYS.map(k => (
                  <th key={k} className="px-8 py-3 text-center">{k}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="divide-x divide-gray-50">
                {MIN_STAFF_KEYS.map(k => (
                  <td key={k} className="px-8 py-6 text-center">
                    {editingMinStaff ? (
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => setMinStaffDraft(d => ({ ...d, [k]: Math.max(0, (d[k] ?? minStaffConfig[k] ?? 2) - 1) }))}
                          className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 font-black text-gray-600 flex items-center justify-center transition-colors"
                        >−</button>
                        <span className="text-2xl font-black text-zinc-900 w-8 text-center">
                          {minStaffDraft[k] ?? minStaffConfig[k] ?? 2}
                        </span>
                        <button
                          onClick={() => setMinStaffDraft(d => ({ ...d, [k]: (d[k] ?? minStaffConfig[k] ?? 2) + 1 }))}
                          className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 font-black text-gray-600 flex items-center justify-center transition-colors"
                        >+</button>
                      </div>
                    ) : (
                      <span className="text-2xl font-black text-zinc-900">{minStaffConfig[k] ?? 2}</span>
                    )}
                    <div className="text-[10px] text-gray-400 mt-0.5">人/天</div>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 节假日配置 */}
      <div className="bg-white rounded-[2rem] border shadow-xl overflow-hidden">
        <div className="px-8 py-5 border-b bg-gray-50/80 flex items-center gap-3">
          <Settings size={18} className="text-zinc-500" />
          <h2 className="text-base font-black text-gray-900 tracking-tight">节假日配置</h2>
          <div className="ml-auto flex items-center gap-2">
            {editingHoliday ? (
              <>
                <button
                  onClick={() => setShowHolidayImportModal(true)}
                  className="px-3 py-1.5 rounded-xl border border-indigo-200 bg-indigo-50 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition-all"
                >批量新增</button>
                <button
                  onClick={() => setHolidayDraft(d => [...d, { date: '', name: '', type: '节假日', isLegal: true }])}
                  className="px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-all"
                >+ 新增一行</button>
                <button
                  onClick={() => setEditingHoliday(false)}
                  className="px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 transition-all"
                >取消</button>
                <button
                  onClick={handleSaveHoliday}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 text-white text-xs font-bold hover:bg-black transition-all disabled:opacity-50"
                ><CheckCircle2 size={13} /> {saving ? '保存中…' : '保存配置'}</button>
              </>
            ) : (
              <button
                onClick={() => {
                  setHolidayDraft([...globalHolidayConfig]);
                  setEditingHoliday(true);
                }}
                className="px-3 py-1.5 rounded-xl border border-gray-200 bg-white text-xs font-bold text-gray-700 hover:bg-gray-50 transition-all"
              >编辑</button>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b text-xs font-bold text-gray-500 uppercase tracking-wide">
                <th className="px-6 py-3 text-left">日期</th>
                <th className="px-4 py-3 text-left">名称</th>
                <th className="px-4 py-3 text-center">类型</th>
                <th className="px-4 py-3 text-center">法定节假日</th>
                {editingHoliday && <th className="px-4 py-3 text-center w-16">删除</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(editingHoliday ? holidayDraft : globalHolidayConfig).length === 0 ? (
                <tr>
                  <td colSpan={editingHoliday ? 5 : 4} className="px-6 py-12 text-center text-gray-400 text-sm">
                    暂无节假日配置
                  </td>
                </tr>
              ) : (editingHoliday ? holidayDraft : globalHolidayConfig).map((row, i) => (
                <tr key={i} className="hover:bg-gray-50/40 transition-all">
                  <td className="px-6 py-3">
                    {editingHoliday ? (
                      <input
                        type="text"
                        value={row.date}
                        onChange={e => setHolidayDraft(d => d.map((r, ri) => ri === i ? { ...r, date: e.target.value } : r))}
                        placeholder="如 2026/04/05"
                        className="w-36 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-zinc-400"
                      />
                    ) : (
                      <span className="font-mono text-gray-700">{row.date}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editingHoliday ? (
                      <input
                        type="text"
                        value={row.name}
                        onChange={e => setHolidayDraft(d => d.map((r, ri) => ri === i ? { ...r, name: e.target.value } : r))}
                        placeholder="节日名称"
                        className="w-28 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-zinc-400"
                      />
                    ) : (
                      <span className="font-medium text-gray-800">{row.name}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {editingHoliday ? (
                      <select
                        value={row.type}
                        onChange={e => setHolidayDraft(d => d.map((r, ri) => ri === i ? { ...r, type: e.target.value as HolidayRow['type'], isLegal: e.target.value === '节假日' } : r))}
                        className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-zinc-400"
                      >
                        <option value="节假日">节假日</option>
                        <option value="调休上班日">调休上班日</option>
                      </select>
                    ) : (
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                        row.type === '节假日' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-purple-50 text-purple-700 border-purple-200'
                      }`}>{row.type}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {editingHoliday ? (
                      <button
                        onClick={() => setHolidayDraft(d => d.map((r, ri) => ri === i ? { ...r, isLegal: !r.isLegal } : r))}
                        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none ${row.isLegal ? 'bg-green-500' : 'bg-gray-200'}`}
                      >
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${row.isLegal ? 'translate-x-4' : 'translate-x-0.5'}`} />
                      </button>
                    ) : (
                      row.isLegal
                        ? <CheckCircle2 size={16} className="text-green-500 mx-auto" />
                        : <span className="text-gray-300 text-xs font-bold">—</span>
                    )}
                  </td>
                  {editingHoliday && (
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => setHolidayDraft(d => d.filter((_, ri) => ri !== i))}
                        className="text-red-400 hover:text-red-600 transition-colors"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" /></svg>
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 批量导入节假日弹窗 */}
      {showHolidayImportModal && (
        <div className="fixed inset-0 z-[300] bg-black/60 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setShowHolidayImportModal(false); }}>
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg p-8 space-y-5">
            <h3 className="text-xl font-black text-gray-900">批量新增节假日</h3>
            <p className="text-xs text-gray-400">每行一条，格式：日期 名称 类型<br />例：2026/04/05 清明节 节假日</p>
            <textarea
              value={holidayImportText}
              onChange={e => { setHolidayImportText(e.target.value); setHolidayImportPreview(null); }}
              rows={8}
              placeholder="2026/04/05&#10;清明节&#10;节假日"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-xs font-mono resize-y focus:outline-none focus:ring-2 focus:ring-zinc-900"
            />
            {holidayImportPreview && (
              <div className="bg-gray-50 rounded-xl p-4 space-y-1 max-h-48 overflow-y-auto">
                <div className="text-[10px] font-bold text-gray-400 mb-2">预览 {holidayImportPreview.length} 条：</div>
                {holidayImportPreview.map((h, i) => (
                  <div key={i} className="text-xs font-mono text-gray-700">{h.date} · {h.name} · {h.type}</div>
                ))}
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowHolidayImportModal(false)} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-all">取消</button>
              {!holidayImportPreview ? (
                <button
                  onClick={() => setHolidayImportPreview(parseHolidayImport(holidayImportText))}
                  disabled={!holidayImportText.trim()}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-all disabled:opacity-40"
                >预览</button>
              ) : (
                <button
                  disabled={holidayImportPreview.length === 0}
                  onClick={() => {
                    setHolidayDraft(d => [...d, ...holidayImportPreview]);
                    setShowHolidayImportModal(false);
                    setHolidayImportText('');
                    setHolidayImportPreview(null);
                  }}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-zinc-900 text-white text-sm font-bold hover:bg-black transition-all disabled:opacity-40"
                >确认添加 {holidayImportPreview.length} 条</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
