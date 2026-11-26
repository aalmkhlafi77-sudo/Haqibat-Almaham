import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Check,
  GripVertical,
  Palette,
  Pin,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getContrastTextColor, PRESET_LABEL_COLORS } from '../domain/shareUtils';
import { LabelItem, LabelTargetType } from '../types/domain';

interface LabelsSectionProps {
  targetType: LabelTargetType;
  targetId: string | null;
  compact?: boolean;
}

interface WorkspacePinnedLabelsProps {
  targetType: LabelTargetType;
  targetId: string | null;
}

const PAD = 8;

/**
 * Clamps a label's (x, y) pixel position strictly inside the container bounds.
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

/**
 * Responsive coordinate resolution: uses desktop cached coordinates when width >= 1024,
 * and clamps within current visible viewport width so it's always visible on mobile.
 */
export function getResponsiveLabelPosition(
  lbl: LabelItem,
  containerWidth: number,
  containerHeight: number,
  chipWidth: number,
  chipHeight: number
): { x: number; y: number } {
  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 1024;
  const preferredX = isDesktop && lbl.desktopPosX != null ? lbl.desktopPosX : (lbl.posX ?? PAD);
  const preferredY = isDesktop && lbl.desktopPosY != null ? lbl.desktopPosY : (lbl.posY ?? PAD);

  return clampLabelPosition(preferredX, preferredY, chipWidth, chipHeight, containerWidth, containerHeight);
}

interface LabelEditorModalProps {
  isOpen: boolean;
  label: LabelItem | null;
  targetType: LabelTargetType;
  targetId: string | null;
  onClose: () => void;
}

const LabelEditorModal: React.FC<LabelEditorModalProps> = ({
  isOpen,
  label,
  targetType,
  targetId,
  onClose,
}) => {
  const { saveLabel, deleteLabel } = useApp();
  const [draftText, setDraftText] = useState('');
  const [draftBg, setDraftBg] = useState(PRESET_LABEL_COLORS[0].bg);
  const [draftAttentionPulse, setDraftAttentionPulse] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (label) {
        setDraftText(label.text);
        setDraftBg(label.bgColor);
        setDraftAttentionPulse(!!label.attentionPulse);
      } else {
        setDraftText('');
        setDraftBg(PRESET_LABEL_COLORS[3].bg);
        setDraftAttentionPulse(false);
      }
      setError('');
    }
  }, [isOpen, label]);

  if (!isOpen) return null;

  const previewTextColor = getContrastTextColor(draftBg);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = draftText.trim();
    if (!trimmed) {
      setError('أدخل نص الملصق قبل الحفظ.');
      return;
    }
    saveLabel({
      id: label?.id ?? undefined,
      targetType,
      targetId,
      text: trimmed,
      bgColor: draftBg,
      textColor: previewTextColor,
      posX: label?.posX ?? PAD * 2,
      posY: label?.posY ?? PAD * 4,
      desktopPosX: label?.desktopPosX ?? label?.posX ?? PAD * 2,
      desktopPosY: label?.desktopPosY ?? label?.posY ?? PAD * 4,
      pinnedToWorkspace: label?.pinnedToWorkspace ?? false,
      attentionPulse: draftAttentionPulse,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="glass-panel max-w-md w-full rounded-2xl p-5 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-3">
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Palette className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>{label ? 'تعديل الملصق' : 'إضافة ملصق جديد'}</span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              نص الملصق *
            </label>
            <input
              type="text"
              autoFocus
              value={draftText}
              onChange={(e) => {
                setDraftText(e.target.value);
                if (error) setError('');
              }}
              placeholder="اكتب ملاحظة أو تنبيهًا مختصرًا..."
              className="w-full rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-[#14161b] px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {error && <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">{error}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
              لون الخلفية
            </label>
            <div className="flex flex-wrap items-center gap-2">
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
              <label className="inline-flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-200 px-2 py-1 rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-[#14161b] cursor-pointer">
                <span>لون مخصص</span>
                <input
                  type="color"
                  value={draftBg}
                  onChange={(e) => setDraftBg(e.target.value)}
                  className="w-5 h-5 border-0 bg-transparent p-0 cursor-pointer"
                />
              </label>
            </div>
          </div>

          <div>
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-amber-800 dark:text-amber-200 cursor-pointer">
              <input
                type="checkbox"
                checked={draftAttentionPulse}
                onChange={(e) => setDraftAttentionPulse(e.target.checked)}
              />
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>لفت الانتباه (نبض حركي لإبراز الملصق على الشاشة)</span>
            </label>
          </div>

          <div className="rounded-xl p-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
            <span className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1.5 font-medium">
              معاينة فورية مع تباين النص التلقائي:
            </span>
            <div
              style={{ backgroundColor: draftBg, color: previewTextColor }}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium border border-black/10 inline-flex items-center gap-2 ${
                draftAttentionPulse ? 'label-attention-pulse' : ''
              }`}
            >
              <span>{draftText.trim() || 'نص الملصق التجريبي'}</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div>
              {label && (
                <button
                  type="button"
                  onClick={() => {
                    deleteLabel(label.id);
                    onClose();
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>حذف الملصق</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-white/15 text-xs font-medium text-slate-700 dark:text-slate-200"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1 px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 text-xs font-semibold"
              >
                <Check className="w-3.5 h-3.5" />
                <span>حفظ الملصق</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

/**
 * Renders labels pinned onto the workspace surface (Today view or Record Drawer).
 */
export const WorkspacePinnedLabels: React.FC<WorkspacePinnedLabelsProps> = ({
  targetType,
  targetId,
}) => {
  const { db, hasPerm, saveLabel, deleteLabel, showToast } = useApp();
  const canWriteLabels = hasPerm('records:write');
  const canDeleteLabels = hasPerm('records:delete');

  const pinnedLabels = db.labels.filter(
    (l) =>
      l.targetType === targetType &&
      (l.targetId ?? null) === (targetId ?? null) &&
      l.pinnedToWorkspace
  );

  const containerRef = useRef<HTMLDivElement | null>(null);
  const chipRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const [draggingState, setDraggingState] = useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);

  const [editingLabel, setEditingLabel] = useState<LabelItem | null>(null);
  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({
    width: 600,
    height: 600,
  });

  // Re-measure container and responsive positions on resize
  useEffect(() => {
    const measureContainer = () => {
      const parent = containerRef.current?.parentElement;
      if (!parent) return;
      const w = parent.clientWidth || 600;
      const h = Math.max(parent.scrollHeight || 600, parent.clientHeight || 600);
      setContainerSize({ width: w, height: h });
    };

    measureContainer();
    window.addEventListener('resize', measureContainer);
    return () => window.removeEventListener('resize', measureContainer);
  }, []);

  const handlePointerDown = (
    e: React.PointerEvent<HTMLButtonElement>,
    lbl: LabelItem
  ) => {
    if (!e.isPrimary || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    const parent = containerRef.current?.parentElement;
    const chipEl = chipRefs.current[lbl.id];
    if (!parent || !chipEl) return;

    const parentRect = parent.getBoundingClientRect();
    const chipRect = chipEl.getBoundingClientRect();
    const pointerOffsetX = e.clientX - chipRect.left;
    const pointerOffsetY = e.clientY - chipRect.top;

    const chipW = chipEl.offsetWidth || 180;
    const chipH = chipEl.offsetHeight || 40;

    const currentPos = getResponsiveLabelPosition(
      lbl,
      parent.clientWidth,
      Math.max(parent.scrollHeight, parent.clientHeight),
      chipW,
      chipH
    );

    setDraggingState({ id: lbl.id, x: currentPos.x, y: currentPos.y });

    let latest = { x: currentPos.x, y: currentPos.y };
    const handleEl = e.currentTarget;
    try {
      handleEl.setPointerCapture(e.pointerId);
    } catch {}

    const onPointerMove = (ev: PointerEvent) => {
      const scrollLeft = parent.scrollLeft || 0;
      const scrollTop = parent.scrollTop || 0;
      const rawX = ev.clientX - parentRect.left + scrollLeft - pointerOffsetX;
      const rawY = ev.clientY - parentRect.top + scrollTop - pointerOffsetY;

      const pW = parent.clientWidth;
      const pH = Math.max(parent.scrollHeight, parent.clientHeight);
      latest = clampLabelPosition(rawX, rawY, chipW, chipH, pW, pH);

      setDraggingState({ id: lbl.id, x: latest.x, y: latest.y });
    };

    const onPointerUp = () => {
      try {
        handleEl.releasePointerCapture(e.pointerId);
      } catch {}
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);

      setDraggingState(null);

      const isDesktop = window.innerWidth >= 1024;
      saveLabel({
        ...lbl,
        pinnedToWorkspace: true,
        posX: latest.x,
        posY: latest.y,
        desktopPosX: isDesktop ? latest.x : (lbl.desktopPosX ?? latest.x),
        desktopPosY: isDesktop ? latest.y : (lbl.desktopPosY ?? latest.y),
      });
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  };

  const handleUnpin = (lbl: LabelItem) => {
    saveLabel({
      ...lbl,
      pinnedToWorkspace: false,
    });
    showToast('تمت إعادة الملصق إلى اللوحة.');
  };

  if (pinnedLabels.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none z-20 overflow-visible"
    >
      {pinnedLabels.map((lbl) => {
        const chipEl = chipRefs.current[lbl.id];
        const chipW = chipEl?.offsetWidth || 180;
        const chipH = chipEl?.offsetHeight || 40;
        const isDragging = draggingState?.id === lbl.id;

        const pos = isDragging
          ? { x: draggingState.x, y: draggingState.y }
          : getResponsiveLabelPosition(
              lbl,
              containerSize.width,
              containerSize.height,
              chipW,
              chipH
            );

        const textColor = getContrastTextColor(lbl.bgColor);

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
              maxWidth: 'calc(100% - 16px)',
            }}
            className={`absolute inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs sm:text-sm font-medium border border-black/15 shadow-md pointer-events-auto select-none transition-shadow ${
              isDragging ? 'shadow-2xl ring-2 ring-blue-500 scale-[1.02] z-30' : 'hover:shadow-lg'
            } ${lbl.attentionPulse && !isDragging ? 'label-attention-pulse' : ''}`}
          >
            {canWriteLabels && (
              <button
                type="button"
                onPointerDown={(e) => handlePointerDown(e, lbl)}
                title="اسحب لتحريك الملصق على سطح العمل"
                aria-label={`مقبض سحب الملصق ${lbl.text}`}
                className="p-1 rounded-md hover:bg-black/10 cursor-grab active:cursor-grabbing touch-none shrink-0"
              >
                <GripVertical className="w-3.5 h-3.5 opacity-75" />
              </button>
            )}

            {canWriteLabels ? (
              <button
                type="button"
                onClick={() => setEditingLabel(lbl)}
                title="انقر لتعديل الملصق"
                className="text-right hover:underline focus:outline-none truncate max-w-[200px] sm:max-w-[300px]"
              >
                {lbl.text}
              </button>
            ) : (
              <span className="text-right truncate max-w-[200px] sm:max-w-[300px]">
                {lbl.text}
              </span>
            )}

            {lbl.attentionPulse && (
              <Sparkles
                className="w-3.5 h-3.5 shrink-0 opacity-80"
                aria-label="ملصق بلفت انتباه"
              />
            )}

            <button
              type="button"
              onClick={() => handleUnpin(lbl)}
              title="إعادة إلى اللوحة وإخلاء سطح العمل"
              aria-label="إعادة إلى اللوحة"
              className="p-1 rounded hover:bg-black/10 transition-colors shrink-0 opacity-80 hover:opacity-100"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            {canDeleteLabels && (
              <button
                type="button"
                onClick={() => deleteLabel(lbl.id)}
                title="حذف الملصق"
                aria-label={`حذف الملصق ${lbl.text}`}
                className="p-1 rounded hover:bg-black/10 transition-colors shrink-0 text-rose-700 dark:text-rose-300"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        );
      })}

      {editingLabel && (
        <LabelEditorModal
          isOpen={true}
          label={editingLabel}
          targetType={targetType}
          targetId={targetId}
          onClose={() => setEditingLabel(null)}
        />
      )}
    </div>
  );
};

export const LabelsSection: React.FC<LabelsSectionProps> = ({
  targetType,
  targetId,
  compact = false,
}) => {
  const { db, hasPerm, saveLabel, deleteLabel, showToast } = useApp();
  const canWriteLabels = hasPerm('records:write');
  const canDeleteLabels = hasPerm('records:delete');

  const allLabels = db.labels.filter(
    (l) => l.targetType === targetType && (l.targetId ?? null) === (targetId ?? null)
  );

  const boardLabels = allLabels.filter((l) => !l.pinnedToWorkspace);
  const pinnedLabels = allLabels.filter((l) => l.pinnedToWorkspace);

  const boardRef = useRef<HTMLDivElement | null>(null);
  const chipRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const [boardSize, setBoardSize] = useState<{ width: number; height: number }>({
    width: 420,
    height: compact ? 160 : 210,
  });

  const [draggingState, setDraggingState] = useState<{
    id: string;
    x: number;
    y: number;
    isOverWorkspace: boolean;
  } | null>(null);

  const [editingLabel, setEditingLabel] = useState<LabelItem | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  // Measure board bounds
  const recomputeBoardSize = () => {
    const board = boardRef.current;
    if (!board) return;
    const width = board.clientWidth || 420;
    const minH = compact ? 150 : 200;
    let neededH = minH;

    boardLabels.forEach((lbl, idx) => {
      const el = chipRefs.current[lbl.id];
      const chipH = el?.offsetHeight || 38;
      const rawY = lbl.posY ?? PAD + idx * 48;
      neededH = Math.max(neededH, rawY + chipH + PAD);
    });

    setBoardSize((prev) =>
      prev.width === width && prev.height === neededH ? prev : { width, height: neededH }
    );
  };

  useLayoutEffect(() => {
    recomputeBoardSize();
  }, [boardLabels.length, compact]);

  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;

    const handleResize = () => {
      recomputeBoardSize();
      const w = board.clientWidth || 420;
      const h = Math.max(compact ? 150 : 200, board.clientHeight || 200);
      boardLabels.forEach((lbl) => {
        if (lbl.posX == null || lbl.posY == null) return;
        const el = chipRefs.current[lbl.id];
        const cw = el?.offsetWidth || 180;
        const ch = el?.offsetHeight || 38;
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

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [boardLabels, compact]);

  const getEffectiveBoardPosition = (lbl: LabelItem, idx: number) => {
    if (draggingState && draggingState.id === lbl.id) {
      return { x: draggingState.x, y: draggingState.y };
    }
    const el = chipRefs.current[lbl.id];
    const cw = el?.offsetWidth || 190;
    const ch = el?.offsetHeight || 38;
    const rawX = lbl.posX ?? PAD;
    const rawY = lbl.posY ?? PAD + idx * 48;
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
    if (!e.isPrimary || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    const board = boardRef.current;
    const el = chipRefs.current[lbl.id];
    if (!board || !el) return;

    const workspaceEl = board.closest('[data-label-workspace]') as HTMLElement | null;
    const boardRect = board.getBoundingClientRect();
    const wsRect = workspaceEl ? workspaceEl.getBoundingClientRect() : boardRect;

    const startPos = getEffectiveBoardPosition(lbl, idx);
    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const chipW = el.offsetWidth || 180;
    const chipH = el.offsetHeight || 38;

    const handleEl = e.currentTarget;
    try {
      handleEl.setPointerCapture(e.pointerId);
    } catch {}

    setDraggingState({ id: lbl.id, x: startPos.x, y: startPos.y, isOverWorkspace: false });

    let latest = { x: startPos.x, y: startPos.y, isOverWorkspace: false };

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startClientX;
      const dy = ev.clientY - startClientY;

      // Check if dragged outside the dashed board bounds onto workspace
      const isOutsideBoard =
        ev.clientX < boardRect.left ||
        ev.clientX > boardRect.right ||
        ev.clientY < boardRect.top ||
        ev.clientY > boardRect.bottom;

      if (isOutsideBoard && workspaceEl) {
        // Compute position relative to workspace
        const wsScrollLeft = workspaceEl.scrollLeft || 0;
        const wsScrollTop = workspaceEl.scrollTop || 0;
        const wsX = ev.clientX - wsRect.left + wsScrollLeft - (startClientX - (boardRect.left + startPos.x));
        const wsY = ev.clientY - wsRect.top + wsScrollTop - (startClientY - (boardRect.top + startPos.y));

        const clampedWs = clampLabelPosition(
          wsX,
          wsY,
          chipW,
          chipH,
          workspaceEl.clientWidth,
          Math.max(workspaceEl.scrollHeight, workspaceEl.clientHeight)
        );
        latest = { x: clampedWs.x, y: clampedWs.y, isOverWorkspace: true };
      } else {
        const clampedBoard = clampLabelPosition(
          startPos.x + dx,
          startPos.y + dy,
          chipW,
          chipH,
          board.clientWidth || boardSize.width,
          Math.max(board.clientHeight || boardSize.height, compact ? 150 : 200)
        );
        latest = { x: clampedBoard.x, y: clampedBoard.y, isOverWorkspace: false };
      }

      setDraggingState({ id: lbl.id, x: latest.x, y: latest.y, isOverWorkspace: latest.isOverWorkspace });
    };

    const onUp = () => {
      try {
        handleEl.releasePointerCapture(e.pointerId);
      } catch {}
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      setDraggingState(null);

      const isDesktop = window.innerWidth >= 1024;
      if (latest.isOverWorkspace) {
        saveLabel({
          ...lbl,
          pinnedToWorkspace: true,
          posX: latest.x,
          posY: latest.y,
          desktopPosX: isDesktop ? latest.x : latest.x,
          desktopPosY: isDesktop ? latest.y : latest.y,
        });
        showToast('تم نقل الملصق وتثبيته على سطح العمل.');
      } else {
        saveLabel({
          ...lbl,
          pinnedToWorkspace: false,
          posX: latest.x,
          posY: latest.y,
        });
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  const pinToWorkspaceDirectly = (lbl: LabelItem) => {
    const isDesktop = window.innerWidth >= 1024;
    const defaultX = PAD * 2;
    const defaultY = PAD * 4;
    saveLabel({
      ...lbl,
      pinnedToWorkspace: true,
      posX: defaultX,
      posY: defaultY,
      desktopPosX: isDesktop ? defaultX : (lbl.desktopPosX ?? defaultX),
      desktopPosY: isDesktop ? defaultY : (lbl.desktopPosY ?? defaultY),
    });
    showToast('تم تثبيت الملصق على سطح العمل.');
  };

  const returnToBoardDirectly = (lbl: LabelItem) => {
    saveLabel({
      ...lbl,
      pinnedToWorkspace: false,
    });
    showToast('تمت إعادة الملصق إلى اللوحة.');
  };

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
            الملصقات الملونة ({allLabels.length})
          </span>
          {pinnedLabels.length > 0 && (
            <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">
              ({pinnedLabels.length} مثبت على سطح العمل)
            </span>
          )}
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            اسحب من المقبض إلى سطح العمل لتثبيته، أو انقر النص للتعديل
          </span>
        </div>

        {canWriteLabels && (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 whitespace-nowrap transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>إضافة ملصق</span>
          </button>
        )}
      </div>

      {allLabels.length === 0 && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          لا توجد ملصقات بعد. اضغط «إضافة ملصق» لإنشاء ملاحظة ملونة قابلة للسحب والتثبيت على سطح العمل.
        </p>
      )}

      {/* Pinned Labels Quick Access List in Board */}
      {pinnedLabels.length > 0 && (
        <div className="rounded-xl border border-blue-200 dark:border-blue-900/40 bg-blue-50/40 dark:bg-blue-950/20 p-2.5 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
              <Pin className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>الملصقات المثبتة على سطح العمل:</span>
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {pinnedLabels.map((lbl) => {
              const textColor = getContrastTextColor(lbl.bgColor);
              return (
                <div
                  key={`pinned-summary-${lbl.id}`}
                  style={{ backgroundColor: lbl.bgColor, color: textColor }}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium border border-black/10 shadow-sm"
                >
                  <button
                    type="button"
                    onClick={() => setEditingLabel(lbl)}
                    className="hover:underline truncate max-w-[180px]"
                    title="تعديل الملصق"
                  >
                    {lbl.text}
                  </button>
                  <button
                    type="button"
                    onClick={() => returnToBoardDirectly(lbl)}
                    title="إعادة إلى اللوحة وإخلاء سطح العمل"
                    className="p-0.5 rounded hover:bg-black/10 text-slate-700 dark:text-slate-200"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                  {canDeleteLabels && (
                    <button
                      type="button"
                      onClick={() => deleteLabel(lbl.id)}
                      title="حذف الملصق"
                      className="p-0.5 rounded hover:bg-black/10 text-rose-700 dark:text-rose-300"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Unpinned / Board Labels Container */}
      <div
        ref={boardRef}
        dir="ltr"
        style={{ minHeight: `${boardSize.height}px` }}
        className="relative w-full rounded-xl border border-dashed border-slate-300/80 dark:border-white/15 bg-slate-50/60 dark:bg-white/[0.02] select-none p-2"
      >
        {boardLabels.length === 0 ? (
          <div className="h-full flex items-center justify-center p-6 text-center text-xs text-slate-400 dark:text-slate-500">
            {pinnedLabels.length > 0
              ? 'جميع الملصقات مثبتة حاليًا على سطح العمل. يمكنك إعادتها إلى اللوحة في أي وقت.'
              : 'لوحة الملصقات فارغة. أضف ملصقًا جديدًا واسحبه إلى سطح العمل.'}
          </div>
        ) : (
          boardLabels.map((lbl, idx) => {
            const textColor = getContrastTextColor(lbl.bgColor);
            const pos = getEffectiveBoardPosition(lbl, idx);
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
                className={`absolute inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs sm:text-sm font-medium border border-black/10 shadow-sm ${
                  isDragging
                    ? 'z-30 shadow-2xl ring-2 ring-blue-500 scale-[1.02]'
                    : 'z-10 hover:shadow-md'
                } ${lbl.attentionPulse && !isDragging ? 'label-attention-pulse' : ''}`}
              >
                {canWriteLabels && (
                  <button
                    type="button"
                    onPointerDown={(e) => handleDragPointerDown(e, lbl, idx)}
                    title="اسحب لنقله داخل اللوحة أو إلى سطح العمل"
                    aria-label={`مقبض سحب الملصق ${lbl.text}`}
                    className="p-1 rounded-md hover:bg-black/10 cursor-grab active:cursor-grabbing touch-none shrink-0"
                  >
                    <GripVertical className="w-3.5 h-3.5 opacity-75" />
                  </button>
                )}

                {canWriteLabels ? (
                  <button
                    type="button"
                    onClick={() => setEditingLabel(lbl)}
                    title="انقر لتعديل الملصق"
                    className="text-right hover:underline focus:outline-none truncate max-w-[200px] sm:max-w-[280px]"
                  >
                    {lbl.text}
                  </button>
                ) : (
                  <span className="text-right truncate max-w-[200px] sm:max-w-[280px]">
                    {lbl.text}
                  </span>
                )}

                {lbl.attentionPulse && (
                  <Sparkles
                    className="w-3.5 h-3.5 shrink-0 opacity-80"
                    aria-label="ملصق بلفت انتباه"
                  />
                )}

                <button
                  type="button"
                  onClick={() => pinToWorkspaceDirectly(lbl)}
                  title="تثبيت على سطح العمل"
                  aria-label="تثبيت على سطح العمل"
                  className="p-1 rounded hover:bg-black/10 transition-colors shrink-0 text-blue-700 dark:text-blue-300"
                >
                  <Pin className="w-3.5 h-3.5" />
                </button>

                {canDeleteLabels && (
                  <button
                    type="button"
                    onClick={() => deleteLabel(lbl.id)}
                    title="حذف الملصق"
                    aria-label={`حذف الملصق ${lbl.text}`}
                    className="p-1 rounded hover:bg-black/10 transition-colors shrink-0 text-rose-700 dark:text-rose-300"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Editor Modal */}
      {(isAdding || editingLabel) && (
        <LabelEditorModal
          isOpen={true}
          label={editingLabel}
          targetType={targetType}
          targetId={targetId}
          onClose={() => {
            setIsAdding(false);
            setEditingLabel(null);
          }}
        />
      )}
    </div>
  );
};
