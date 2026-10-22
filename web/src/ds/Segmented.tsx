import { useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { Icon, type IconName } from "./icons";
import s from "./Segmented.module.css";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: IconName;
  disabled?: boolean;
  title?: string;
  /** User-test label (`data-track`, kebab-case, never user data). */
  track?: string;
}

export interface SegmentedProps<T extends string> {
  label: string;
  hideLabel?: boolean;
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  fullWidth?: boolean;
  /** User-test label prefix: an option without its own `track` gets `<track>-<value>` (`data-track`, kebab-case, never user data). */
  track?: string;
}

interface Thumb { x: number; y: number; w: number; h: number; animate: boolean }

/** Radio group styled as a segmented control. Arrow keys move and select.
 * A raised pill thumb slides under the selected option (docs/motion.md 3.2): it is measured from the option's
 * box (offsetLeft/Top — correct in RTL too) and moved with transform. It snaps without a slide on first paint
 * and when the move crosses a wrapped row (a diagonal slide reads as a glitch). */
export function Segmented<T extends string>({ label, hideLabel, options, value, onChange, fullWidth, track }: SegmentedProps<T>) {
  const id = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const groupRef = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<Thumb | null>(null);
  const selectedIndex = options.findIndex((o) => o.value === value);
  useLayoutEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    const measure = (animate: boolean) => {
      const el = refs.current[selectedIndex];
      if (!el || !el.offsetWidth) {
        setThumb(null);
        return;
      }
      const next = { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight };
      setThumb((prev) => {
        if (prev && prev.x === next.x && prev.y === next.y && prev.w === next.w && prev.h === next.h) return prev;
        return { ...next, animate: animate && Boolean(prev) && prev?.y === next.y };
      });
    };
    measure(true);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => measure(false));
    ro.observe(group);
    return () => ro.disconnect();
  }, [selectedIndex, options.length]);
  const enabled = options.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0);
  const onKey = (event: KeyboardEvent, index: number) => {
    const forward = event.key === "ArrowRight" || event.key === "ArrowDown";
    const back = event.key === "ArrowLeft" || event.key === "ArrowUp";
    if (!forward && !back) return;
    event.preventDefault();
    const pos = enabled.indexOf(index);
    const nextPos = forward ? (pos + 1) % enabled.length : (pos - 1 + enabled.length) % enabled.length;
    const nextIndex = enabled[nextPos];
    if (nextIndex === undefined) return;
    const opt = options[nextIndex];
    if (opt) {
      onChange(opt.value);
      refs.current[nextIndex]?.focus();
    }
  };
  return (
    <div className={s.wrap}>
      <span id={`${id}-l`} className={hideLabel ? "visually-hidden" : s.legend}>{label}</span>
      <div ref={groupRef} role="radiogroup" aria-labelledby={`${id}-l`}
        className={`${s.group} ${fullWidth ? s.full : ""} ${thumb ? s.hasThumb : ""}`}>
        {thumb ? (
          <span
            aria-hidden="true"
            className={`${s.thumb} ${thumb.animate ? s.slide : ""}`}
            style={{ "--thumb-x": `${thumb.x}px`, "--thumb-y": `${thumb.y}px`, "--thumb-w": `${thumb.w}px`, "--thumb-h": `${thumb.h}px` } as CSSProperties}
          />
        ) : null}
        {options.map((o, i) => {
          const checked = o.value === value;
          return (
            <button
              key={o.value}
              ref={(el) => { refs.current[i] = el; }}
              type="button"
              role="radio"
              aria-checked={checked}
              tabIndex={checked ? 0 : -1}
              disabled={o.disabled}
              title={o.title}
              data-track={o.track ?? (track ? `${track}-${o.value.toLowerCase().replace(/[^a-z0-9]+/g, "-")}` : undefined)}
              className={s.option}
              onClick={() => onChange(o.value)}
              onKeyDown={(e) => onKey(e, i)}
            >
              {o.icon ? <Icon name={o.icon} size="sm" /> : null}
              <span className={s.optionLabel}>{o.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
