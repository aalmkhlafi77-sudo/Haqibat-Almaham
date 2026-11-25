import React, { useState } from 'react';
import { Check, Palette, Plus, Trash2, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getContrastTextColor, PRESET_LABEL_COLORS } from '../domain/shareUtils';
import { LabelItem, LabelTargetType } from '../types/domain';

interface LabelsSectionProps {
  targetType: LabelTargetType;
  targetId: string | null;
  compact?: boolean;
}

export const LabelsSection: React.FC<LabelsSectionProps> = ({
  targetType,
  targetId,
  compact = false,
}) => {
  const { db, saveLabel, deleteLabel } = useApp();
  const labels = db.labels.filter(
    (l) => l.targetType === targetType && (l.targetId ?? null) === (targetId ?? null)
  );

  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [draftText, setDraftText] = useState('');
  const [draftBg, setDraftBg] = useState(PRESET_LABEL_COLORS[0].bg);
  const [error, setError] = useState('');

  const previewTextColor = getContrastTextColor(draftBg);

  const startAdd = () => {
    setEditingId(null);
    setDraftText('');
    setDraftBg(PRESET_LABEL_COLORS[3].bg);
    setError('');
    setIsAdding(true);
  };

  const startEdit = (lbl: LabelItem) => {
    setIsAdding(false);
    setEditingId(lbl.id);
    setDraftText(lbl.text);
    setDraftBg(lbl.bgColor);
    setError('');
  };

  const cancelEdit = () => {
    setIsAdding(false);
    setEditingId(null);
    setError('');
  };

  const handleSave = () => {
    const trimmed = draftText.trim();
    if (!trimmed) {
      setError('أدخل نص الملصق قبل الحفظ.');
      return;
    }
    saveLabel({
      id: editingId ?? undefined,
      targetType,
      targetId,
      text: trimmed,
      bgColor: draftBg,
      textColor: previewTextColor,
    });
    setIsAdding(false);
    setEditingId(null);
    setError('');
  };

  const renderEditor = () => (
    <div className="glass-surface-subtle rounded-xl p-3 space-y-3 mt-2">
      <div>
        <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
          نص الملصق
        </label>
        <input
          type="text"
          value={draftText}
          onChange={(e) => {
            setDraftText(e.target.value);
            if (error) setError('');
          }}
          placeholder="اكتب ملاحظة أو تنبيهًا مختصرًا..."
          className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {error && <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">{error}</p>}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-1">
          <Palette className="w-3.5 h-3.5" />
          <span>لون الخلفية:</span>
        </span>
        {PRESET_LABEL_COLORS.map((preset) => (
          <button
            key={preset.bg}
            type="button"
            title={preset.name}
            onClick={() => setDraftBg(preset.bg)}
            style={{ backgroundColor: preset.bg }}
            className={`w-7 h-7 rounded-lg border transition-transform ${
              draftBg.toLowerCase() === preset.bg.toLowerCase()
                ? 'ring-2 ring-blue-600 scale-105 border-slate-900 dark:border-white'
                : 'border-slate-300 dark:border-slate-600'
            }`}
          />
        ))}
        <label className="inline-flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-200 px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 cursor-pointer">
          <span>لون مخصص</span>
          <input
            type="color"
            value={draftBg}
            onChange={(e) => setDraftBg(e.target.value)}
            className="w-5 h-5 border-0 bg-transparent p-0 cursor-pointer"
          />
        </label>
      </div>

      <div>
        <span className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
          معاينة فورية مع ضبط تباين النص تلقائيًا:
        </span>
        <div
          style={{ backgroundColor: draftBg, color: previewTextColor }}
          className="rounded-lg px-3 py-2 text-sm font-medium border border-black/10"
        >
          {draftText.trim() || 'معاينة نص الملصق على اللون المختار'}
        </div>
      </div>

      <div className="flex items-center gap-2 justify-end">
        <button
          type="button"
          onClick={cancelEdit}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800 whitespace-nowrap"
        >
          <X className="w-3.5 h-3.5" />
          <span>إلغاء</span>
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 whitespace-nowrap"
        >
          <Check className="w-3.5 h-3.5" />
          <span>حفظ الملصق</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
          الملصقات الملونة ({labels.length})
        </span>
        {!isAdding && (
          <button
            type="button"
            onClick={startAdd}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>إضافة ملصق</span>
          </button>
        )}
      </div>

      {labels.length === 0 && !isAdding && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          لا توجد ملصقات بعد. اضغط «إضافة ملصق» لإنشاء ملاحظة ملونة.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {labels.map((lbl) => {
          const textColor = getContrastTextColor(lbl.bgColor);
          if (editingId === lbl.id) {
            return (
              <div key={lbl.id} className="w-full">
                {renderEditor()}
              </div>
            );
          }
          return (
            <div
              key={lbl.id}
              style={{ backgroundColor: lbl.bgColor, color: textColor }}
              className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium border border-black/10 max-w-full"
            >
              <button
                type="button"
                onClick={() => startEdit(lbl)}
                title="انقر لتعديل الملصق"
                className="text-right hover:underline focus:outline-none"
              >
                {lbl.text}
              </button>
              <button
                type="button"
                onClick={() => deleteLabel(lbl.id)}
                title="حذف الملصق"
                aria-label={`حذف الملصق ${lbl.text}`}
                className="p-1 rounded hover:bg-black/10 transition-colors shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {isAdding && renderEditor()}
    </div>
  );
};
