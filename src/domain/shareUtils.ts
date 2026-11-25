import { ShareChannel } from '../types/domain';

export const PRESET_LABEL_COLORS = [
  { name: 'أزرق سماوي', bg: '#E0F2FE' },
  { name: 'تركوازي', bg: '#CCFBF1' },
  { name: 'بنفسجي ناعم', bg: '#EDE9FE' },
  { name: 'ذهبي دافئ', bg: '#FEF3C7' },
  { name: 'أخضر نعناعي', bg: '#DCFCE7' },
  { name: 'وردي تحذيري', bg: '#FFE4E6' },
  { name: 'كحلي عميق', bg: '#1E3A8A' },
  { name: 'زمردي داكن', bg: '#065F46' },
];

/**
 * Computes accessible WCAG foreground text color (#0F172A or #FFFFFF) for any hex background.
 */
export function getContrastTextColor(hexColor: string): string {
  const clean = hexColor.replace('#', '');
  if (clean.length !== 6) return '#0F172A';
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;

  const toLinear = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

  const luminance =
    0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);

  return luminance > 0.36 ? '#0F172A' : '#FFFFFF';
}

export function normalizeSaudiMobileForWhatsApp(mobile: string): string {
  const digits = mobile.replace(/\D/g, '');
  if (digits.startsWith('05') && digits.length === 10) {
    return `966${digits.slice(1)}`;
  }
  if (digits.startsWith('00')) {
    return digits.slice(2);
  }
  return digits;
}

export function buildExternalShareUrl(
  channel: ShareChannel,
  mobile: string,
  email: string,
  subject: string,
  body: string
): string {
  if (channel === 'whatsapp') {
    const phone = normalizeSaudiMobileForWhatsApp(mobile);
    const text = encodeURIComponent(body);
    return phone
      ? `https://wa.me/${phone}?text=${text}`
      : `https://wa.me/?text=${text}`;
  }
  const encodedSubject = encodeURIComponent(subject);
  const encodedBody = encodeURIComponent(body);
  return `mailto:${encodeURIComponent(email)}?subject=${encodedSubject}&body=${encodedBody}`;
}

export function buildRecordDeepLink(
  recordType: string,
  recordId: string
): { url: string; isLocalPreview: boolean } {
  if (typeof window === 'undefined') {
    return { url: '', isLocalPreview: true };
  }
  const url = new URL(window.location.href);
  url.searchParams.set('recordType', recordType);
  url.searchParams.set('recordId', recordId);
  return {
    url: url.toString(),
    isLocalPreview: true,
  };
}
