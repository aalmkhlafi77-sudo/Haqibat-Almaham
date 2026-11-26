export function HaqibatMark({ size = 'regular' }: { size?: 'small' | 'regular' | 'large' }) {
  const dimensions = { small: 'size-7', regular: 'size-9', large: 'size-14 sm:size-16' };
  return (
    <span
      aria-hidden="true"
      data-haqibat-mark={size}
      className={`relative block shrink-0 rounded-[25%] bg-linear-to-br from-[#292d35] to-[#101217] shadow-[inset_0_0_0_1px_#e6b96766,inset_0_1px_2px_#ffffff20,0_3px_7px_#00000030] ${dimensions[size]}`}
    >
      <span className="absolute top-[18%] left-[38%] h-[17%] w-[24%] rounded-t-[35%] border-[1.5px] border-[#e6b967] border-b-0" />
      <span className="absolute top-[31%] left-[20%] h-[50%] w-[60%] rounded-[21%] border-[1.5px] border-[#f3c878] bg-linear-to-br from-[#5b4230] to-[#29241f]">
        <span className="absolute top-[49%] left-0 h-px w-full bg-[#cda75c]/65" />
        <span className="absolute top-[20%] left-[40%] h-[42%] w-[25%] rotate-45 border-r-[1.5px] border-b-[1.5px] border-[#fff0c6]" />
      </span>
    </span>
  );
}

export function DesignerSignature({ appearance = 'app' }: { appearance?: 'app' | 'lamp' }) {
  return (
    <a
      href="https://almkhlafi.carpetbazar.org/"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="تصميم عبدالله المخلافي 2026، موقع المصمم يفتح في تبويب جديد"
      className={`inline-block max-w-full rounded px-1 text-center text-[11px] font-semibold leading-snug underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 ${appearance === 'lamp'
        ? 'text-[#ddd0bd] hover:text-[#ffe5a9] focus-visible:outline-[#f5c76a]'
        : 'text-slate-600 hover:text-slate-950 focus-visible:outline-blue-600 dark:text-slate-300 dark:hover:text-white'}`}
    >
      تصميم <span>عبدالله المخلافي</span> <span className="tabular-nums" dir="ltr">2026</span>
    </a>
  );
}
