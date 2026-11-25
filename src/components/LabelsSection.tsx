import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Check, GripVertical, Palette, Plus, Sparkles, Trash2, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getContrastTextColor, PRESET_LABEL_COLORS } from '../domain/shareUtils';
import { LabelItem, LabelTargetType } from '../types/domain';

interface LabelsSectionProps {
  targetType: LabelTargetType;
  targetId: string | null;
  compact?: boolean;
}

const PAD = 8;

/**
 * Clamps a label's (x, y) pixel position strictly inside the visible workspace container.
 */
export function clampLabelPosition(
  x: number,
  y: number,
  chipWidth: number,
  chipHeight: number,
  containerWidth: number,
  containerHeight: number
): { x: number; y: number } {
  const maxX = Math.max(PAD, containerWidth - chipWidth - PAD);
  const maxY = Math.max(PAD, containerHeight - chipHeight - PAD);
  return {
    x: Math.round(Math.max(PAD, Math.min(maxX, x))),
    y: Math.round(Math.max(PAD, Math.min(maxY, y))),
  };
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

  const boardRef = useRef<HTMLDivElement | null>(null);
  const chipRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const [boardSize, setBoardSize] = useState<{ width: number; height: number }>({
    width: 420,
    height: compact ? 180 : 240,
  });
  const [draggingState, setDraggingState] = useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [draftText, setDraftText] = useState('');
  const [draftBg, setDraftBg] = useState(PRESET_LABEL_COLORS[0].bg);
  const [draftAttentionPulse, setDraftAttentionPulse] = useState(false);
  const [error, setError] = useState('');

  const previewTextColor = getContrastTextColor(draftBg);

  // Measure workspace bounds and re-clamp on container/viewport resize
  const recomputeBoardAndClamp = () => {
    const board = boardRef.current;
    if (!board) return;
    const width = board.clientWidth || 420;
    const minH = compact ? 170 : 230;
    let neededH = minH;

    labels.forEach((lbl, idx) => {
      const el = chipRefs.current[lbl.id];
      const chipH = el?.offsetHeight || 40;
      const rawY = lbl.posY ?? PAD + idx * 52;
      neededH = Math.max(neededH, rawY + chipH + PAD);
    });

    setBoardSize((prev) =>
      prev.width === width && prev.height === neededH
        ? prev
        : { width, height: neededH }
    );
  };

  useLayoutEffect(() => {
    recomputeBoardAndClamp();
  }, [labels.length, compact, editingId]);

  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;

    const handleResize = () => {
      recomputeBoardAndClamp();
      // Clamp any saved positions that would exceed the new container width
      const w = board.clientWidth || 420;
      const h = Math.max(compact ? 170 : 230, board.clientHeight || 230);
      labels.forEach((lbl) => {
        if (lbl.posX == null || lbl.posY == null) return;
        const el = chipRefs.current[lbl.id];
        const cw = el?.offsetWidth || 180;
        const ch = el?.offsetHeight || 40;
        const clamped = clampLabelPosition(lbl.posX, lbl.posY, cw, ch, w, h);
        if (clamped.x !== lbl.posX || clamped.y !== lbl.posY) {
          saveLabel({
            ...lbl,
            posX: clamped.x,
            posY: clamped.y,
          });
        }
      });
    };

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(handleResize);
      ro.observe(board);
    }
    window.addEventListener('resize', handleResize);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, [labels, compact]);

  const getEffectivePosition = (lbl: LabelItem, idx: number) => {
    if (draggingState && draggingState.id === lbl.id) {
      return { x: draggingState.x, y: draggingState.y };
    }
    const el = chipRefs.current[lbl.id];
    const cw = el?.offsetWidth || 190;
    const ch = el?.offsetHeight || 40;
    const rawX = lbl.posX ?? PAD;
    const rawY = lbl.posY ?? PAD + idx * 52;
    return clampLabelPosition(
      rawX,
      rawY,
      cw,
      ch,
      boardSize.width,
      Math.max(boardSize.height, rawY + ch + PAD)
    );
  };

  const handleDragPointerDown = (
    e: React.PointerEvent<HTMLButtonElement>,
    lbl: LabelItem,
    idx: number
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const board = boardRef.current;
    const el = chipRefs.current[lbl.id];
    if (!board || !el) return;

    const startPos = getEffectivePosition(lbl, idx);
    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const chipW = el.offsetWidth || 180;
    const chipH = el.offsetHeight || 40;
    const containerW = board.clientWidth || boardSize.width;
    const containerH = Math.max(board.clientHeight || boardSize.height, compact ? 170 : 230);

    setDraggingState({ id: lbl.id, x: startPos.x, y: startPos.y });

    let latest = { x: startPos.x, y: startPos.y };

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startClientX;
      const dy = ev.clientY - startClientY;
      latest = clampLabelPosition(
        startPos.x + dx,
        startPos.y + dy,
        chipW,
        chipH,
        containerW,
        containerH
      );
      setDraggingState({ id: lbl.id, x: latest.x, y: latest.y });
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      setDraggingState(null);
      saveLabel({
        ...lbl,
        posX: latest.x,
        posY: latest.y,
      });
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  const startAdd = () => {
    setEditingId(null);
    setDraftText('');
    setDraftBg(PRESET_LABEL_COLORS[3].bg);
    setDraftAttentionPulse(false);
    setError('');
    setIsAdding(true);
  };

  const startEdit = (lbl: LabelItem) => {
    setIsAdding(false);
    setEditingId(lbl.id);
    setDraftText(lbl.text);
    setDraftBg(lbl.bgColor);
    setDraftAttentionPulse(!!lbl.attentionPulse);
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
    const existing = editingId ? labels.find((l) => l.id === editingId) : undefined;
    const defaultY = PAD + labels.length * 52;
    saveLabel({
      id: editingId ?? undefined,
      targetType,
      targetId,
      text: trimmed,
      bgColor: draftBg,
      textColor: previewTextColor,
      posX: existing?.posX ?? PAD,
      posY: existing?.posY ?? defaultY,
      attentionPulse: draftAttentionPulse,
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
        <label className="inline-flex items-center gap-2 text-xs font-semibold text-amber-800 dark:text-amber-200 cursor-pointer">
          <input
            type="checkbox"
            checked={draftAttentionPulse}
            onChange={(e) => setDraftAttentionPulse(e.target.checked)}
          />
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>لفت الانتباه (حركة/نبض لطيف لإبراز الملصق)</span>
        </label>
      </div>

      <div>
        <span className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
          معاينة فورية مع ضبط تباين النص تلقائيًا:
        </span>
        <div
          style={{ backgroundColor: draftBg, color: previewTextColor }}
          className={`rounded-lg px-3 py-2 text-sm font-medium border border-black/10 inline-flex items-center gap-2 ${
            draftAttentionPulse ? 'label-attention-pulse' : ''
          }`}
        >
          <span>{draftText.trim() || 'معاينة نص الملصق على اللون المختار'}</span>
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
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            الملصقات الملونة ({labels.length})
          </span>
          {labels.length > 0 && (
            <span className="text-[11px] text-slate-400 dark:text-slate-400">
              اسحب من أيقونة المقبض لتثبيت الموقع، وانقر النص للتعديل
            </span>
          )}
        </div>
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
          لا توجد ملصقات بعد. اضغط «إضافة ملصق» لإنشاء ملاحظة ملونة قابلة للسحب والتموضع.
        </p>
      )}

      {labels.length > 0 && (
        <div
          ref={boardRef}
          dir="ltr"
          style={{ minHeight: `${boardSize.height}px` }}
          className="relative w-full rounded-xl border border-dashed border-slate-300/80 dark:border-white/15 bg-slate-50/60 dark:bg-white/[0.02] overflow-hidden select-none"
        >
          {labels.map((lbl, idx) => {
            if (editingId === lbl.id) return null;
            const textColor = getContrastTextColor(lbl.bgColor);
            const pos = getEffectivePosition(lbl, idx);
            const isDragging = draggingState?.id === lbl.id;

            return (
              <div
                key={lbl.id}
                ref={(el) => {
                  chipRefs.current[lbl.id] = el;
                }}
                dir="rtl"
                style={{
                  left: `${pos.x}px`,
                  top: `${pos.y}px`,
                  backgroundColor: lbl.bgColor,
                  color: textColor,
                  maxWidth: `calc(100% - ${PAD * 2}px)`,
                }}
                className={`absolute inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-sm font-medium border border-black/10 shadow-sm ${
                  isDragging ? 'z-30 shadow-xl ring-2 ring-blue-500' : 'z-10'
                } ${lbl.attentionPulse && !isDragging ? 'label-attention-pulse' : ''}`}
              >
                <button
                  type="button"
                  onPointerDown={(e) => handleDragPointerDown(e, lbl, idx)}
                  title="اسحب لتحريك الملصق وتثبيته"
                  aria-label={`مقبض سحب الملصق ${lbl.text}`}
                  className="p-1 rounded-md hover:bg-black/10 cursor-grab active:cursor-grabbing touch-none shrink-0"
                >
                  <GripVertical className="w-3.5 h-3.5 opacity-75" />
                </button>

                <button
                  type="button"
                  onClick={() => startEdit(lbl)}
                  title="انقر لتعديل الملصق"
                  className="text-right hover:underline focus:outline-none truncate max-w-[260px] sm:max-w-[320px]"
                >
                  {lbl.text}
                </button>

                {lbl.attentionPulse && (
                  <Sparkles
                    className="w-3.5 h-3.5 shrink-0 opacity-80"
                    aria-label="ملصق بلفت انتباه"
                  />
                )}

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
      )}

      {editingId && renderEditor()}
      {isAdding && renderEditor()}
    </div>
  );
};
