/**
 * حقيبة المهام | غلاف تسجيل الدخول بالمصباح
 *
 * Save as src/components/HaqibatLampLogin.tsx and wrap the existing login
 * view's form or form card with <HaqibatLampLogin>{existingForm}</HaqibatLampLogin>.
 * Keep the existing submit handler, fields, errors, loading state and routing.
 * Mount this only inside the signed-out route. Use React 19, with no new packages.
 *
 * Interaction reference: UI Vault / Lamp Login Animation
 * https://github.com/aalmkhlafi77-sudo/ui-vault/tree/94332157e2e12acd5b452e74e938f6c7355f8f1f/src/library-items/lamp-login-animation
 */
import { useEffect, useId, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent, ReactNode } from 'react';

interface HaqibatLampLoginProps {
  children: ReactNode;
  title?: string;
}

const PULL_THRESHOLD = 30;
const MAX_PULL = 52;
const lampColors = [
  { id: 'white', label: 'أبيض طبيعي', color: '#f5f4ee' },
  { id: 'green', label: 'أخضر فسفوري', color: '#a6ff00' },
  { id: 'red', label: 'أحمر نيون', color: '#ff313f' },
  { id: 'blue', label: 'أزرق نيون', color: '#25a0ff' },
  { id: 'yellow', label: 'أصفر', color: '#f5c76a' },
] as const;

type LampColor = typeof lampColors[number];

const beamDust = [
  [47, 12, 1.2], [55, 19, 1.6], [38, 27, 1.1], [58, 31, 2],
  [49, 37, 1.4], [32, 42, 1.8], [68, 45, 1.3], [42, 49, 2.2],
  [54, 54, 1.1], [62, 59, 1.8], [28, 62, 1.2], [48, 65, 1.6],
  [76, 69, 1.4], [38, 72, 2], [57, 76, 1.1], [23, 79, 1.7],
  [68, 84, 2.1], [45, 89, 1.3], [82, 91, 1.4], [32, 94, 1.2],
] as const;

export default function HaqibatLampLogin({
  children,
  title = 'حقيبة المهام',
}: HaqibatLampLoginProps) {
  const [lit, setLit] = useState(false);
  const [lightColor, setLightColor] = useState<LampColor>(lampColors[4]);
  const [pull, setPull] = useState(0);
  const [dragging, setDragging] = useState(false);
  const formId = useId();
  const formRegion = useRef<HTMLDivElement>(null);
  const drag = useRef<{ pointerId: number; startY: number } | null>(null);
  const ignorePointerClick = useRef(false);

  useEffect(() => {
    if (lit) formRegion.current?.focus({ preventScroll: true });
  }, [lit]);

  function startPull(event: PointerEvent<HTMLButtonElement>) {
    if (!event.isPrimary || event.button !== 0) return;
    ignorePointerClick.current = false;
    drag.current = { pointerId: event.pointerId, startY: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  }

  function movePull(event: PointerEvent<HTMLButtonElement>) {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    setPull(Math.max(0, Math.min(MAX_PULL, event.clientY - current.startY)));
  }

  function finishPull(event: PointerEvent<HTMLButtonElement>, cancelled: boolean) {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const distance = event.clientY - current.startY;
    drag.current = null;
    setDragging(false);
    setPull(0);
    ignorePointerClick.current = cancelled || Math.abs(distance) > 8;
    if (!cancelled && distance >= PULL_THRESHOLD) setLit((value) => !value);
  }

  return (
    <main className="haq-lamp" dir="rtl" data-lit={lit} data-dragging={dragging}
      style={{
        '--haq-pull': `${pull}px`,
        '--haq-light': lightColor.id === 'yellow' ? undefined : lightColor.color,
      } as CSSProperties}>
      <style>{lampStyles}</style>
      <div className="haq-lamp__ambient" aria-hidden="true" />
      <div className="haq-lamp__layout">
        <div className="haq-lamp__intro">
          <h1>{title}</h1>
          <div className="haq-lamp__colors" role="group" aria-label="لون إضاءة المصباح">
            {lampColors.map((option) => (
              <button
                key={option.id}
                type="button"
                className="haq-lamp__color"
                aria-label={option.label}
                aria-pressed={lightColor.id === option.id}
                title={option.label}
                style={{ '--haq-swatch': option.color } as CSSProperties}
                onClick={() => setLightColor(option)}
              />
            ))}
          </div>
          <div className="haq-lamp__fixture">
            <div className="haq-lamp__shade" aria-hidden="true" />
            <div className="haq-lamp__bulb" aria-hidden="true" />
            <div className="haq-lamp__beam" aria-hidden="true">
              {beamDust.map(([x, y, size], index) => (
                <span
                  key={index}
                  className="haq-lamp__dust"
                  style={{
                    left: `${x}%`,
                    top: `${y}%`,
                    width: size,
                    height: size,
                    '--haq-dust-drift': index % 2 === 0 ? '-9px' : '10px',
                    animationDuration: `${6 + (index % 5) * 1.3}s`,
                    animationDelay: `${-(index % 7) * 1.1}s`,
                  } as CSSProperties}
                />
              ))}
            </div>
            <div className="haq-lamp__stand" aria-hidden="true" />
            <div className="haq-lamp__base" aria-hidden="true" />
            <span className="haq-lamp__cord" aria-hidden="true" />
            <button
              type="button" className="haq-lamp__pull"
              aria-label={lit ? 'إطفاء المصباح' : 'تشغيل المصباح'}
              aria-pressed={lit} aria-controls={formId}
              onPointerDown={startPull}
              onPointerMove={movePull}
              onPointerUp={(event) => finishPull(event, false)}
              onPointerCancel={(event) => finishPull(event, true)}
              onLostPointerCapture={(event) => finishPull(event, true)}
              onClick={(event) => {
                if (event.detail > 0 && ignorePointerClick.current) {
                  ignorePointerClick.current = false;
                  return;
                }
                setLit((value) => !value);
              }}
            />
          </div>
          <p className="haq-lamp__hint">
            {lit ? 'المصباح مضاء' : 'اسحب حبل المصباح إلى أسفل'}
          </p>
          <button type="button" className="haq-lamp__reveal" aria-controls={formId}
            aria-expanded={lit} onClick={() => setLit((value) => !value)}>
            {lit ? 'إخفاء نموذج الدخول' : 'إظهار نموذج الدخول'}
          </button>
        </div>
        <div ref={formRegion} id={formId} className="haq-lamp__form"
          role="region" aria-label="نموذج تسجيل الدخول" tabIndex={-1}
          inert={!lit} aria-hidden={!lit}>
          {children}
        </div>
      </div>
    </main>
  );
}

const lampStyles = `
.haq-lamp {
  --haq-gold: #f5c76a;
  --haq-pull: 0px;
  min-height: 100svh;
  display: grid;
  place-items: center;
  position: relative;
  isolation: isolate;
  overflow: clip;
  box-sizing: border-box;
  padding: clamp(18px, 5vw, 56px);
  background: #08090c;
  color: #f4f1ea;
}
.haq-lamp[data-lit="true"] { background: #11100f; }
.haq-lamp__ambient {
  position: absolute; inset: 0; pointer-events: none;
  background: radial-gradient(ellipse at 72% 42%, color-mix(in srgb, var(--haq-light, #f3ad49) 19%, transparent), transparent 64%);
  opacity: 0; transition: opacity 420ms ease;
}
.haq-lamp[data-lit="true"] .haq-lamp__ambient { opacity: 1; }
.haq-lamp__layout {
  position: relative; width: min(100%, 920px);
  display: grid; grid-template-columns: minmax(0, .85fr) minmax(0, 1.15fr);
  align-items: center; gap: clamp(20px, 5vw, 75px);
}
.haq-lamp__intro { display: grid; place-items: center; text-align: center; }
.haq-lamp__intro h1 { margin: 0 0 18px; font-weight: 750; font-size: clamp(24px, 4vw, 38px); }
.haq-lamp__colors { display: flex; margin: -8px 0 4px; }
.haq-lamp__color {
  display: grid; place-items: center; width: 44px; height: 44px; padding: 0;
  border: 0; border-radius: 50%; background: transparent; cursor: pointer;
}
.haq-lamp__color::before {
  content: ''; width: 14px; height: 14px; border-radius: 50%;
  background: var(--haq-swatch); box-shadow: 0 0 9px var(--haq-swatch);
}
.haq-lamp__color[aria-pressed="true"]::before {
  outline: 2px solid #f4f1ea; outline-offset: 4px;
}
.haq-lamp__fixture { width: 230px; height: 230px; position: relative; direction: ltr; }
.haq-lamp__shade {
  position: absolute; z-index: 3; top: 8px; left: 46px; width: 138px; height: 57px;
  border-radius: 67% 67% 12% 12% / 100% 100% 18% 18%;
  background: linear-gradient(155deg, #555359, #1b1c20 55%, #101114);
  box-shadow: inset 0 -3px #050507, inset 0 2px #ffffff22;
}
.haq-lamp__bulb {
  position: absolute; z-index: 2; top: 57px; left: 90px; width: 50px; height: 15px;
  border-radius: 50%; background: #35343a; transition: box-shadow 350ms, background 350ms;
}
.haq-lamp[data-lit="true"] .haq-lamp__bulb {
  background: var(--haq-light, #fff2bd);
  box-shadow: 0 6px 30px 12px color-mix(in srgb, var(--haq-light, #ffc762) 60%, transparent);
}
.haq-lamp__beam {
  position: absolute; top: 61px; left: -80px; width: 390px; height: 230px;
  clip-path: polygon(38% 0, 62% 0, 100% 100%, 0 100%);
  background: linear-gradient(
    color-mix(in srgb, var(--haq-light, #ffc96b) 40%, transparent),
    color-mix(in srgb, var(--haq-light, #f4ae41) 13%, transparent) 70%, transparent
  );
  opacity: 0; transition: opacity 420ms ease; pointer-events: none;
}
.haq-lamp[data-lit="true"] .haq-lamp__beam { opacity: 1; }
.haq-lamp__dust {
  position: absolute; border-radius: 50%; opacity: .32;
  background: color-mix(in srgb, var(--haq-light, #ffc96b) 40%, white);
  box-shadow: 0 0 3px var(--haq-light, #ffc96b);
}
.haq-lamp[data-lit="true"] .haq-lamp__dust {
  animation-name: haq-lamp-dust-drift;
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
  animation-direction: alternate;
}
@keyframes haq-lamp-dust-drift {
  0% { transform: translate(0, 5px); opacity: .16; }
  55% { opacity: .55; }
  100% { transform: translate(var(--haq-dust-drift), -12px); opacity: .12; }
}
.haq-lamp__stand {
  position: absolute; top: 66px; left: 112px; width: 6px; height: 141px;
  background: linear-gradient(90deg, #18191e, #5b5755, #222329);
}
.haq-lamp__base {
  position: absolute; bottom: 20px; left: 67px; width: 96px; height: 13px;
  border-radius: 45% 45% 20% 20%; background: linear-gradient(#454347, #16171c);
}
.haq-lamp__cord {
  position: absolute; z-index: 4; top: 61px; left: 168px; width: 2px;
  height: calc(48px + var(--haq-pull)); background: #a49b86; pointer-events: none;
  transition: height 220ms ease-out;
}
.haq-lamp__pull {
  position: absolute; z-index: 5; top: 90px; left: 147px;
  width: 44px; height: 44px; border: 0; border-radius: 12px;
  cursor: grab; background: transparent; touch-action: none;
  transform: translateY(var(--haq-pull)); transition: transform 220ms ease-out;
}
.haq-lamp__pull::after {
  content: ''; display: block; margin: auto; width: 13px; height: 20px;
  border-radius: 5px; background: linear-gradient(125deg, #ffda8a, #a87527);
  box-shadow: 0 2px 7px #000a;
}
.haq-lamp[data-dragging="true"] :is(.haq-lamp__cord, .haq-lamp__pull) { transition: none; }
.haq-lamp[data-dragging="true"] .haq-lamp__pull { cursor: grabbing; }
.haq-lamp__hint { margin: 0 0 10px; color: #cec8bb; }
.haq-lamp__reveal {
  min-height: 44px; padding: 8px 16px; border: 1px solid #9c7744;
  border-radius: 12px; cursor: pointer; background: #211b13; color: #ffe2a7;
  font: inherit;
}
.haq-lamp :is(.haq-lamp__pull, .haq-lamp__reveal, .haq-lamp__color):focus-visible {
  outline: 2px solid var(--haq-gold); outline-offset: 3px;
}
.haq-lamp__form {
  min-width: 0; opacity: 0; visibility: hidden; transform: translateY(10px);
  transition: opacity 320ms ease, transform 320ms ease;
}
.haq-lamp[data-lit="true"] .haq-lamp__form {
  opacity: 1; visibility: visible; transform: none;
}
@media (max-width: 650px) {
  .haq-lamp__layout { grid-template-columns: minmax(0, 1fr); gap: 20px; }
  .haq-lamp__fixture { height: 200px; }
  .haq-lamp__stand { height: 111px; }
  .haq-lamp[data-lit="false"] .haq-lamp__form { height: 0; overflow: hidden; }
  .haq-lamp__ambient { background: radial-gradient(ellipse at 50% 35%, color-mix(in srgb, var(--haq-light, #f3ad49) 19%, transparent), transparent 65%); }
}
@media (prefers-reduced-motion: reduce) {
  .haq-lamp :is(.haq-lamp__ambient, .haq-lamp__beam, .haq-lamp__bulb,
  .haq-lamp__cord, .haq-lamp__pull, .haq-lamp__form) { transition: none; }
  .haq-lamp__form { transform: none; }
  .haq-lamp[data-lit="true"] .haq-lamp__dust { animation-name: none; }
}
`;
