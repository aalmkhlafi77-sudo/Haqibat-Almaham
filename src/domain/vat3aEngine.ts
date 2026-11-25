import {
  Vat3AAdjustmentDirection,
  Vat3ADraft,
  Vat3ALineId,
  Vat3ALineInput,
  Vat3ALineRuleConfig,
  Vat3ARulesConfig,
  Vat3ATaxMethod,
} from '../types/domain';

export const VAT_3A_RULES_VERSION = '3A-v2.0-configurable';
export const ITEM_14_REVIEW_THRESHOLD_HALALAS = 1_500_000; // 15,000.00 SAR

export const CUSTOMIZABLE_VAT_LINE_IDS: Vat3ALineId[] = [1, 2, 3, 4, 5, 7, 8, 9, 10, 11];

export interface Vat3ALineDefinition {
  id: Vat3ALineId;
  name: string;
  section: 'sales' | 'purchases' | 'summary';
  isTotal?: boolean;
  rateLabel: string;
  amountEditable: boolean;
  adjustmentEditable: boolean;
  vatDirectInput?: boolean;
  allowNegativeAmount?: boolean;
  allowNegativeAdjustment?: boolean;
}

export const VAT_3A_LINE_DEFINITIONS: Vat3ALineDefinition[] = [
  {
    id: 1,
    name: 'المبيعات الخاضعة للنسبة الأساسية',
    section: 'sales',
    rateLabel: '15%',
    amountEditable: true,
    adjustmentEditable: true,
    allowNegativeAmount: false,
    allowNegativeAdjustment: true,
  },
  {
    id: 2,
    name: 'المبيعات التي تتحمل الدولة ضريبتها',
    section: 'sales',
    rateLabel: 'أثر صفري',
    amountEditable: true,
    adjustmentEditable: true,
    allowNegativeAmount: false,
    allowNegativeAdjustment: true,
  },
  {
    id: 3,
    name: 'المبيعات المحلية بالنسبة الصفرية',
    section: 'sales',
    rateLabel: '0%',
    amountEditable: true,
    adjustmentEditable: true,
    allowNegativeAmount: false,
    allowNegativeAdjustment: true,
  },
  {
    id: 4,
    name: 'الصادرات',
    section: 'sales',
    rateLabel: '0%',
    amountEditable: true,
    adjustmentEditable: true,
    allowNegativeAmount: false,
    allowNegativeAdjustment: true,
  },
  {
    id: 5,
    name: 'المبيعات المعفاة',
    section: 'sales',
    rateLabel: 'معفاة',
    amountEditable: true,
    adjustmentEditable: true,
    allowNegativeAmount: false,
    allowNegativeAdjustment: true,
  },
  {
    id: 6,
    name: 'إجمالي المبيعات',
    section: 'sales',
    isTotal: true,
    rateLabel: 'محسوب',
    amountEditable: false,
    adjustmentEditable: false,
  },
  {
    id: 7,
    name: 'المشتريات الخاضعة للنسبة الأساسية',
    section: 'purchases',
    rateLabel: '15%',
    amountEditable: true,
    adjustmentEditable: true,
    allowNegativeAmount: false,
    allowNegativeAdjustment: true,
  },
  {
    id: 8,
    name: 'الاستيرادات المدفوعة ضريبتها عند الاستيراد',
    section: 'purchases',
    rateLabel: '15% (مستندات الجمارك)',
    amountEditable: true,
    adjustmentEditable: true,
    allowNegativeAmount: false,
    allowNegativeAdjustment: true,
  },
  {
    id: 9,
    name: 'الاستيرادات الخاضعة للاحتساب العكسي',
    section: 'purchases',
    rateLabel: 'احتساب عكسي (وثيقة 3A)',
    amountEditable: true,
    adjustmentEditable: true,
    allowNegativeAmount: false,
    allowNegativeAdjustment: false,
  },
  {
    id: 10,
    name: 'المشتريات الخاضعة للنسبة الصفرية',
    section: 'purchases',
    rateLabel: '0%',
    amountEditable: true,
    adjustmentEditable: true,
    allowNegativeAmount: false,
    allowNegativeAdjustment: true,
  },
  {
    id: 11,
    name: 'المشتريات المعفاة',
    section: 'purchases',
    rateLabel: 'معفاة',
    amountEditable: true,
    adjustmentEditable: true,
    allowNegativeAmount: false,
    allowNegativeAdjustment: true,
  },
  {
    id: 12,
    name: 'إجمالي المشتريات',
    section: 'purchases',
    isTotal: true,
    rateLabel: 'محسوب',
    amountEditable: false,
    adjustmentEditable: false,
  },
  {
    id: 13,
    name: 'ضريبة الفترة الحالية',
    section: 'summary',
    isTotal: true,
    rateLabel: 'V6 − V12',
    amountEditable: false,
    adjustmentEditable: false,
  },
  {
    id: 14,
    name: 'تصحيحات من فترات سابقة',
    section: 'summary',
    rateLabel: 'موقّع (±)',
    amountEditable: false,
    adjustmentEditable: false,
    vatDirectInput: true,
    allowNegativeAmount: true,
  },
  {
    id: 15,
    name: 'رصيد ضريبي مرحّل من فترات سابقة',
    section: 'summary',
    rateLabel: 'يُطرح مرة واحدة',
    amountEditable: false,
    adjustmentEditable: false,
    vatDirectInput: true,
    allowNegativeAmount: false,
  },
  {
    id: 16,
    name: 'صافي الضريبة',
    section: 'summary',
    isTotal: true,
    rateLabel: 'V13 + C14 − B15',
    amountEditable: false,
    adjustmentEditable: false,
  },
];

/**
 * Default rules requested in Phase 2 prompt:
 * - Default rate 15%
 * - Line 1 defaults to adjustmentDirection: 'subtract' (يُطرح من المبلغ)
 * - Lines 7, 8 default to 'add' with 'rate'
 * - Lines 2, 3, 4, 5, 10, 11 default to 'add' with 'zero' tax effect
 */
export function buildDefaultVat3ARulesConfig(): Vat3ARulesConfig {
  return {
    defaultRatePercent: 15,
    lineRules: {
      1: { adjustmentDirection: 'subtract', taxMethod: 'rate', customRatePercent: null },
      2: { adjustmentDirection: 'add', taxMethod: 'zero', customRatePercent: null },
      3: { adjustmentDirection: 'add', taxMethod: 'zero', customRatePercent: null },
      4: { adjustmentDirection: 'add', taxMethod: 'zero', customRatePercent: null },
      5: { adjustmentDirection: 'add', taxMethod: 'zero', customRatePercent: null },
      7: { adjustmentDirection: 'add', taxMethod: 'rate', customRatePercent: null },
      8: { adjustmentDirection: 'add', taxMethod: 'rate', customRatePercent: null },
      9: { adjustmentDirection: 'subtract', taxMethod: 'rate', customRatePercent: null },
      10: { adjustmentDirection: 'add', taxMethod: 'zero', customRatePercent: null },
      11: { adjustmentDirection: 'add', taxMethod: 'zero', customRatePercent: null },
    },
  };
}

/**
 * Legacy rules snapshot for migrating previously saved drafts so their stored numbers stay identical.
 */
export function buildLegacyVat3ARulesSnapshot(): Vat3ARulesConfig {
  const cfg = buildDefaultVat3ARulesConfig();
  cfg.lineRules[1] = { adjustmentDirection: 'add', taxMethod: 'rate', customRatePercent: null };
  return cfg;
}

export function getEffectiveLineRule(
  rules: Vat3ARulesConfig,
  lineId: Vat3ALineId
): {
  adjustmentDirection: Vat3AAdjustmentDirection;
  taxMethod: Vat3ATaxMethod;
  effectiveRatePercent: number;
} {
  const defaults = buildDefaultVat3ARulesConfig().lineRules;
  const fallback: Vat3ALineRuleConfig = defaults[lineId] || {
    adjustmentDirection: 'add',
    taxMethod: 'zero',
    customRatePercent: null,
  };
  const r: Vat3ALineRuleConfig = rules.lineRules?.[lineId] || fallback;
  const taxMethod: Vat3ATaxMethod = r.taxMethod === 'zero' ? 'zero' : 'rate';
  const effectiveRatePercent =
    taxMethod === 'zero'
      ? 0
      : r.customRatePercent !== null &&
        r.customRatePercent !== undefined &&
        !Number.isNaN(r.customRatePercent)
      ? r.customRatePercent
      : rules.defaultRatePercent;

  // Band 9 uses dedicated reverse-charge treatment (non-deductible portion), not general add/subtract
  const adjustmentDirection: Vat3AAdjustmentDirection =
    lineId === 9 ? 'subtract' : r.adjustmentDirection === 'subtract' ? 'subtract' : 'add';

  return {
    adjustmentDirection,
    taxMethod,
    effectiveRatePercent,
  };
}

const ARABIC_INDIC_MAP: Record<string, string> = {
  '٠': '0',
  '١': '1',
  '٢': '2',
  '٣': '3',
  '٤': '4',
  '٥': '5',
  '٦': '6',
  '٧': '7',
  '٨': '8',
  '٩': '9',
  '۰': '0',
  '۱': '1',
  '۲': '2',
  '۳': '3',
  '۴': '4',
  '۵': '5',
  '۶': '6',
  '۷': '7',
  '۸': '8',
  '۹': '9',
};

export interface ParsedAmountResult {
  isEmpty: boolean;
  isValid: boolean;
  halalas: number;
  error?: string;
}

export function parseAmountToHalalas(raw: string, allowNegative: boolean): ParsedAmountResult {
  const trimmed = raw.trim();
  if (trimmed === '') {
    return { isEmpty: true, isValid: true, halalas: 0 };
  }

  let normalized = '';
  for (const ch of trimmed) {
    if (ARABIC_INDIC_MAP[ch] !== undefined) {
      normalized += ARABIC_INDIC_MAP[ch];
    } else if (ch === '٫') {
      normalized += '.';
    } else if (ch === '٬') {
      normalized += ',';
    } else if (ch === '−' || ch === '–') {
      normalized += '-';
    } else {
      normalized += ch;
    }
  }

  normalized = normalized.replace(/\s+/g, '');

  let sign = 1;
  if (normalized.startsWith('-')) {
    if (!allowNegative) {
      return {
        isEmpty: false,
        isValid: false,
        halalas: 0,
        error: 'هذا الحقل يقبل صفرًا أو قيمة موجبة فقط.',
      };
    }
    sign = -1;
    normalized = normalized.slice(1);
  } else if (normalized.startsWith('+')) {
    normalized = normalized.slice(1);
  }

  if (normalized === '') {
    return {
      isEmpty: false,
      isValid: false,
      halalas: 0,
      error: 'أدخل قيمة عددية صالحة.',
    };
  }

  if (!/^[0-9.,]+$/.test(normalized)) {
    return {
      isEmpty: false,
      isValid: false,
      halalas: 0,
      error: 'يُمنع إدخال حروف أو رموز غير عددية.',
    };
  }

  const dotParts = normalized.split('.');
  if (dotParts.length > 2) {
    return {
      isEmpty: false,
      isValid: false,
      halalas: 0,
      error: 'تنسيق الفاصل العشري غير صالح.',
    };
  }

  const intPartRaw = dotParts[0];
  const decPartRaw = dotParts[1] ?? '';

  if (decPartRaw.length > 2) {
    return {
      isEmpty: false,
      isValid: false,
      halalas: 0,
      error: 'الحد الأقصى هو منزلتان عشريتان (هللتان).',
    };
  }

  if (decPartRaw.includes(',')) {
    return {
      isEmpty: false,
      isValid: false,
      halalas: 0,
      error: 'لا يمكن وضع فاصل آلاف بعد الفاصلة العشرية.',
    };
  }

  if (intPartRaw.includes(',')) {
    const validGrouped = /^\d{1,3}(,\d{3})+$/.test(intPartRaw);
    if (!validGrouped) {
      return {
        isEmpty: false,
        isValid: false,
        halalas: 0,
        error: 'تنسيق تجميع الآلاف غير صحيح (مثال: 1,000 أو ١٬٠٠٠).',
      };
    }
  }

  const intDigits = intPartRaw.replace(/,/g, '') || '0';
  if (!/^\d+$/.test(intDigits) || (decPartRaw !== '' && !/^\d+$/.test(decPartRaw))) {
    return {
      isEmpty: false,
      isValid: false,
      halalas: 0,
      error: 'قيمة عددية غير صالحة.',
    };
  }

  const sar = Number(intDigits);
  const halalaPart = Number(decPartRaw.padEnd(2, '0'));
  if (!Number.isSafeInteger(sar) || sar > 999_999_999) {
    return {
      isEmpty: false,
      isValid: false,
      halalas: 0,
      error: 'المبلغ يتجاوز الحد المسموح به.',
    };
  }

  const totalHalalas = sign * (sar * 100 + halalaPart);
  return {
    isEmpty: false,
    isValid: true,
    halalas: totalHalalas === 0 ? 0 : totalHalalas,
  };
}

/**
 * R(baseHalalas * (ratePercent / 100)) rounded to nearest integer halala, half away from zero.
 */
export function calculateRateVatHalalas(baseHalalas: number, ratePercent: number): number {
  if (baseHalalas === 0 || ratePercent === 0) return 0;
  // Use basis points (ratePercent * 100) to keep integer precision for decimal rates like 5.5%
  const rateBasisPoints = Math.round(ratePercent * 100);
  const scaled = Math.abs(baseHalalas) * rateBasisPoints;
  const rounded = Math.floor((scaled + 5000) / 10000);
  return baseHalalas < 0 ? -rounded : rounded;
}

export function formatHalalas(halalas: number): string {
  const sign = halalas < 0 ? '-' : '';
  const abs = Math.abs(halalas);
  const sar = Math.floor(abs / 100);
  const rem = abs % 100;
  return `${sign}${sar.toLocaleString('en-US')}.${String(rem).padStart(2, '0')}`;
}

export interface Vat3AComputedLine {
  definition: Vat3ALineDefinition;
  amountHalalas: number;
  adjustmentHalalas: number;
  netBaseHalalas: number;
  vatHalalas: number;
  adjustmentDirection: Vat3AAdjustmentDirection;
  taxMethod: Vat3ATaxMethod;
  effectiveRatePercent: number;
  amountError?: string;
  adjustmentError?: string;
  vatInputError?: string;
  warning?: string;
}

export interface Vat3AEvaluationResult {
  isValid: boolean;
  periodError?: string;
  needsNegativeBaseExplanation: boolean;
  needsItem14Details: boolean;
  item14ThresholdWarning: boolean;
  appliedRules: Vat3ARulesConfig;
  lines: Record<Vat3ALineId, Vat3AComputedLine>;
  v6Halalas: number;
  v12Halalas: number;
  v13Halalas: number;
  c14Halalas: number;
  b15Halalas: number;
  v16Halalas: number;
  netStatusLabel: 'ضريبة مستحقة' | 'رصيد دائن محتمل' | 'لا رصيد';
  errorsSummary: string[];
}

export function createEmptyVat3ALines(): Record<number, Vat3ALineInput> {
  const out: Record<number, Vat3ALineInput> = {};
  for (let i = 1; i <= 16; i += 1) {
    out[i] = { amountRaw: '', adjustmentRaw: '' };
  }
  return out;
}

export function evaluateVat3ADraft(
  draft: Vat3ADraft,
  fallbackRules?: Vat3ARulesConfig
): Vat3AEvaluationResult {
  const appliedRules: Vat3ARulesConfig =
    draft.rulesSnapshot || fallbackRules || buildLegacyVat3ARulesSnapshot();

  const errorsSummary: string[] = [];
  let periodError: string | undefined;

  if (!draft.entityName.trim()) {
    errorsSummary.push('اسم المنشأة مطلوب.');
  }
  if (!draft.periodStart || !draft.periodEnd) {
    periodError = 'حدد بداية الفترة ونهايتها.';
    errorsSummary.push(periodError);
  } else if (draft.periodEnd < draft.periodStart) {
    periodError = 'نهاية الفترة لا يمكن أن تسبق بدايتها.';
    errorsSummary.push(periodError);
  }

  const parsedMap: Partial<Record<Vat3ALineId, Vat3AComputedLine>> = {};
  let hasAnyNegativeNetBase = false;

  for (const def of VAT_3A_LINE_DEFINITIONS) {
    const raw = draft.lines[def.id] || { amountRaw: '', adjustmentRaw: '' };
    const effRule = getEffectiveLineRule(appliedRules, def.id);

    if (def.vatDirectInput) {
      const parsedVat = parseAmountToHalalas(raw.amountRaw, !!def.allowNegativeAmount);
      const line: Vat3AComputedLine = {
        definition: def,
        amountHalalas: 0,
        adjustmentHalalas: 0,
        netBaseHalalas: 0,
        vatHalalas: parsedVat.isValid ? parsedVat.halalas : 0,
        adjustmentDirection: 'add',
        taxMethod: 'rate',
        effectiveRatePercent: appliedRules.defaultRatePercent,
        vatInputError: parsedVat.error,
      };
      if (!parsedVat.isValid && parsedVat.error) {
        errorsSummary.push(`البند ${def.id}: ${parsedVat.error}`);
      }
      parsedMap[def.id] = line;
      continue;
    }

    if (!def.amountEditable && !def.adjustmentEditable) {
      parsedMap[def.id] = {
        definition: def,
        amountHalalas: 0,
        adjustmentHalalas: 0,
        netBaseHalalas: 0,
        vatHalalas: 0,
        adjustmentDirection: 'add',
        taxMethod: 'rate',
        effectiveRatePercent: appliedRules.defaultRatePercent,
      };
      continue;
    }

    const parsedA = parseAmountToHalalas(raw.amountRaw, !!def.allowNegativeAmount);
    const parsedD = parseAmountToHalalas(raw.adjustmentRaw, !!def.allowNegativeAdjustment);

    let amountError = parsedA.error;
    let adjustmentError = parsedD.error;
    let warning: string | undefined;

    if (amountError) errorsSummary.push(`البند ${def.id} (المبلغ): ${amountError}`);
    if (adjustmentError) errorsSummary.push(`البند ${def.id} (التعديل): ${adjustmentError}`);

    const aHal = parsedA.isValid ? parsedA.halalas : 0;
    const dHal = parsedD.isValid ? parsedD.halalas : 0;

    let netBase = 0;
    let vatHalalas = 0;

    if (def.id === 9) {
      // Special Reverse Charge treatment from VAT 3A Doc: uses Band 9's own taxMethod & effectiveRatePercent
      netBase = aHal - dHal;
      if (parsedA.isValid && parsedD.isValid && dHal > aHal) {
        adjustmentError =
          'في الاحتساب العكسي يجب ألا يتجاوز التعديل (الجزء غير القابل للخصم) مبلغ البند.';
        errorsSummary.push(`البند 9: ${adjustmentError}`);
      } else if (parsedA.isValid && parsedD.isValid) {
        if (effRule.taxMethod === 'zero' || effRule.effectiveRatePercent === 0 || dHal === 0) {
          vatHalalas = 0;
        } else {
          const revVat = calculateRateVatHalalas(dHal, effRule.effectiveRatePercent);
          vatHalalas = revVat === 0 ? 0 : -revVat;
        }
        if (dHal > 0) {
          warning = 'خصم جزئي في الاحتساب العكسي: يُراجَع حق الخصم قبل الاعتماد.';
        }
      }
    } else {
      // Apply adjustment direction ONCE so subtraction never flips into addition due to sign
      netBase =
        effRule.adjustmentDirection === 'subtract'
          ? aHal - Math.abs(dHal)
          : aHal + dHal;

      if (netBase < 0) {
        hasAnyNegativeNetBase = true;
        warning = 'الوعاء الصافي سالب؛ يلزم توضيح ومراجعة بشرية.';
      }
      if (def.id === 8 && aHal > 0) {
        warning = warning
          ? `${warning} راجع مستندات الجمارك وما يجوز خصمه.`
          : 'تُراجع مستندات الجمارك وما يجوز خصمه.';
      }

      if (effRule.taxMethod === 'zero' || effRule.effectiveRatePercent === 0) {
        vatHalalas = 0;
      } else {
        vatHalalas = calculateRateVatHalalas(netBase, effRule.effectiveRatePercent);
      }
    }

    parsedMap[def.id] = {
      definition: def,
      amountHalalas: aHal,
      adjustmentHalalas: dHal,
      netBaseHalalas: netBase,
      vatHalalas,
      adjustmentDirection: effRule.adjustmentDirection,
      taxMethod: effRule.taxMethod,
      effectiveRatePercent: effRule.effectiveRatePercent,
      amountError,
      adjustmentError,
      warning,
    };
  }

  // Band 6 = sum(1..5)
  let a6 = 0;
  let d6 = 0;
  let v6 = 0;
  for (const id of [1, 2, 3, 4, 5] as Vat3ALineId[]) {
    const l = parsedMap[id]!;
    a6 += l.amountHalalas;
    d6 += l.adjustmentHalalas;
    v6 += l.vatHalalas;
  }
  parsedMap[6] = {
    definition: VAT_3A_LINE_DEFINITIONS[5],
    amountHalalas: a6,
    adjustmentHalalas: d6,
    netBaseHalalas: a6,
    vatHalalas: v6,
    adjustmentDirection: 'add',
    taxMethod: 'rate',
    effectiveRatePercent: appliedRules.defaultRatePercent,
  };

  // Band 12 = sum(7..11)
  let a12 = 0;
  let d12 = 0;
  let v12 = 0;
  for (const id of [7, 8, 9, 10, 11] as Vat3ALineId[]) {
    const l = parsedMap[id]!;
    a12 += l.amountHalalas;
    d12 += l.adjustmentHalalas;
    v12 += l.vatHalalas;
  }
  parsedMap[12] = {
    definition: VAT_3A_LINE_DEFINITIONS[11],
    amountHalalas: a12,
    adjustmentHalalas: d12,
    netBaseHalalas: a12,
    vatHalalas: v12,
    adjustmentDirection: 'add',
    taxMethod: 'rate',
    effectiveRatePercent: appliedRules.defaultRatePercent,
  };

  // Band 13: V13 = V6 - V12
  const v13 = v6 - v12;
  parsedMap[13] = {
    definition: VAT_3A_LINE_DEFINITIONS[12],
    amountHalalas: 0,
    adjustmentHalalas: 0,
    netBaseHalalas: 0,
    vatHalalas: v13,
    adjustmentDirection: 'add',
    taxMethod: 'rate',
    effectiveRatePercent: appliedRules.defaultRatePercent,
  };

  const c14 = parsedMap[14]!.vatHalalas;
  const b15 = parsedMap[15]!.vatHalalas;

  const needsItem14Details = c14 !== 0;
  const item14ThresholdWarning = Math.abs(c14) >= ITEM_14_REVIEW_THRESHOLD_HALALAS;
  if (needsItem14Details && (!draft.item14PeriodRef?.trim() || !draft.item14Reason?.trim())) {
    errorsSummary.push('عند إدخال تصحيح في البند 14 يلزم تسجيل مرجع الفترة وسبب التصحيح.');
  }

  if (hasAnyNegativeNetBase && !draft.negativeBaseExplanation?.trim()) {
    errorsSummary.push('يوجد وعاء صافٍ سالب في أحد البنود؛ أضف توضيحًا للمراجعة البشرية.');
  }

  const v16 = v13 + c14 - b15;
  parsedMap[16] = {
    definition: VAT_3A_LINE_DEFINITIONS[15],
    amountHalalas: 0,
    adjustmentHalalas: 0,
    netBaseHalalas: 0,
    vatHalalas: v16,
    adjustmentDirection: 'add',
    taxMethod: 'rate',
    effectiveRatePercent: appliedRules.defaultRatePercent,
  };

  const netStatusLabel =
    v16 > 0 ? 'ضريبة مستحقة' : v16 < 0 ? 'رصيد دائن محتمل' : 'لا رصيد';

  return {
    isValid: errorsSummary.length === 0,
    periodError,
    needsNegativeBaseExplanation: hasAnyNegativeNetBase,
    needsItem14Details,
    item14ThresholdWarning,
    appliedRules,
    lines: parsedMap as Record<Vat3ALineId, Vat3AComputedLine>,
    v6Halalas: v6,
    v12Halalas: v12,
    v13Halalas: v13,
    c14Halalas: c14,
    b15Halalas: b15,
    v16Halalas: v16,
    netStatusLabel,
    errorsSummary,
  };
}

export interface Vat3ATestPreset {
  key: string;
  title: string;
  expectedSummary: string;
  buildDraftFields: () => Partial<Vat3ADraft>;
}

export const VAT_3A_TEST_PRESETS: Vat3ATestPreset[] = [
  {
    key: 'subtract-135',
    title: 'البند 1 بالطرح الافتراضي (1,000 − 100 = 135.00)',
    expectedSummary: 'مبيعات 1,000 − تعديل 100 = وعاء 900 · ضريبة 135.00 عند 15%',
    buildDraftFields: () => {
      const lines = createEmptyVat3ALines();
      lines[1] = { amountRaw: '1000', adjustmentRaw: '100' };
      return {
        entityName: 'مسودة اختبار — البند 1 بالطرح (135.00)',
        lines,
        rulesSnapshot: buildDefaultVat3ARulesConfig(),
        item14PeriodRef: '',
        item14Reason: '',
        negativeBaseExplanation: '',
      };
    },
  },
  {
    key: 'basic-95',
    title: 'الحالة المرجعية بالجمع (صافي 95.00 ريال)',
    expectedSummary: 'مبيعات 1,000 + تعديل 100 = 165.00 · مشتريات 60.00 · الصافي 95.00',
    buildDraftFields: () => {
      const lines = createEmptyVat3ALines();
      lines[1] = { amountRaw: '1000', adjustmentRaw: '100' };
      lines[7] = { amountRaw: '400', adjustmentRaw: '' };
      lines[14] = { amountRaw: '10', adjustmentRaw: '' };
      lines[15] = { amountRaw: '20', adjustmentRaw: '' };
      return {
        entityName: 'مسودة اختبار — الحالة الأساسية بالجمع 95.00',
        lines,
        rulesSnapshot: buildLegacyVat3ARulesSnapshot(),
        item14PeriodRef: 'الربع الثاني 2026',
        item14Reason: 'فحص مطابقة الحالة الأساسية المرجعية',
        negativeBaseExplanation: '',
      };
    },
  },
  {
    key: 'reverse-partial',
    title: 'البند 9: خصم جزئي (صافي 300.00 ريال)',
    expectedSummary: 'مبلغ 10,000 · غير قابل للخصم 2,000 · أثر -300.00 · الصافي 300.00',
    buildDraftFields: () => {
      const lines = createEmptyVat3ALines();
      lines[9] = { amountRaw: '10000', adjustmentRaw: '2000' };
      return {
        entityName: 'مسودة اختبار — البند 9 خصم جزئي',
        lines,
        rulesSnapshot: buildDefaultVat3ARulesConfig(),
        item14PeriodRef: '',
        item14Reason: '',
        negativeBaseExplanation: '',
      };
    },
  },
  {
    key: 'reverse-full',
    title: 'البند 9: خصم كامل (0.00 ريال)',
    expectedSummary: 'مبلغ 10,000 · غير قابل للخصم 0 · الأثر والصافي 0.00',
    buildDraftFields: () => {
      const lines = createEmptyVat3ALines();
      lines[9] = { amountRaw: '10000', adjustmentRaw: '0' };
      return {
        entityName: 'مسودة اختبار — البند 9 خصم كامل',
        lines,
        rulesSnapshot: buildDefaultVat3ARulesConfig(),
        item14PeriodRef: '',
        item14Reason: '',
        negativeBaseExplanation: '',
      };
    },
  },
  {
    key: 'credit-balance',
    title: 'رصيد دائن محتمل (-30.00 ريال)',
    expectedSummary: 'مبيعات 15.00 · مشتريات 45.00 · الصافي -30.00 رصيد دائن محتمل',
    buildDraftFields: () => {
      const lines = createEmptyVat3ALines();
      lines[1] = { amountRaw: '100', adjustmentRaw: '' };
      lines[7] = { amountRaw: '300', adjustmentRaw: '' };
      return {
        entityName: 'مسودة اختبار — رصيد دائن',
        lines,
        rulesSnapshot: buildDefaultVat3ARulesConfig(),
        item14PeriodRef: '',
        item14Reason: '',
        negativeBaseExplanation: '',
      };
    },
  },
  {
    key: 'arabic-rounding',
    title: 'أرقام عربية وتقريب (١٬٠٠٠٫١٠ ← 150.02)',
    expectedSummary: 'يُقرأ المبلغ 1,000.10 وتُحتسب الضريبة 150.02',
    buildDraftFields: () => {
      const lines = createEmptyVat3ALines();
      lines[1] = { amountRaw: '١٬٠٠٠٫١٠', adjustmentRaw: '' };
      return {
        entityName: 'مسودة اختبار — أرقام عربية وتقريب',
        lines,
        rulesSnapshot: buildDefaultVat3ARulesConfig(),
        item14PeriodRef: '',
        item14Reason: '',
        negativeBaseExplanation: '',
      };
    },
  },
  {
    key: 'invalid-input',
    title: 'اختبار رفض الإدخال غير الصالح',
    expectedSummary: 'أحرف في خانة المبلغ + تعديل بند 9 أكبر من مبلغه (يمنع الحفظ)',
    buildDraftFields: () => {
      const lines = createEmptyVat3ALines();
      lines[1] = { amountRaw: 'مئة ريال', adjustmentRaw: '' };
      lines[9] = { amountRaw: '5000', adjustmentRaw: '7000' };
      return {
        entityName: 'مسودة اختبار — تحقق الإدخال غير الصالح',
        lines,
        rulesSnapshot: buildDefaultVat3ARulesConfig(),
        item14PeriodRef: '',
        item14Reason: '',
        negativeBaseExplanation: '',
      };
    },
  },
];
