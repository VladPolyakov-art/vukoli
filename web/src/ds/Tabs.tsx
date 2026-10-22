import { useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { Icon, type IconName } from "./icons";
import s from "./Tabs.module.css";

export interface TabItem<T extends string> {
  id: T;
  label: string;
  icon?: IconName;
  /** Short helper shown next to an inactive tab (e.g. the English-practice hint). */
  hint?: string;
  /** User-test label (`data-track`, kebab-case, never user data). */
  track?: string;
}

export interface TabsProps<T extends string> {
  items: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  /** Prefix for tab / panel ids: panels use `${idBase}-panel-${id}`. */
  idBase: string;
  label: string;
}

/** WAI-ARIA tabs with arrow-key navigation (automatic activation).
 * The selected underline is one bar that slides between tabs (docs/motion.md 3.2, P3): a 1px-wide bar moved
 * with translateX and stretched with scaleX — transform only; a thin bar has no ends to squash. */
export function Tabs<T extends string>({ items, value, onChange, idBase, label }: TabsProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  const [bar, setBar] = useState<{ x: number; w: number; animate: boolean } | null>(null);
  const selectedIndex = items.findIndex((i) => i.id === value);
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const measure = (animate: boolean) => {
      const el = refs.current[selectedIndex];
      if (!el || !el.offsetWidth) {
        setBar(null);
        return;
      }
      const next = { x: el.offsetLeft, w: el.offsetWidth };
      setBar((prev) => (prev && prev.x === next.x && prev.w === next.w ? prev : { ...next, animate: animate && Boolean(prev) }));
    };
    measure(true);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => measure(false));
    ro.observe(list);
    return () => ro.disconnect();
  }, [selectedIndex, items.length]);
  const onKey = (event: KeyboardEvent, index: number) => {
    const last = items.length - 1;
    let next = -1;
    if (event.key === "ArrowRight") next = index === last ? 0 : index + 1;
    else if (event.key === "ArrowLeft") next = index === 0 ? last : index - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    if (next < 0) return;
    event.preventDefault();
    const item = items[next];
    if (item) {
      onChange(item.id);
      refs.current[next]?.focus();
    }
  };
  return (
    <div ref={listRef} role="tablist" aria-label={label} className={`${s.list} ${bar ? s.hasBar : ""}`}>
      {bar ? (
        <span
          aria-hidden="true"
          className={`${s.bar} ${bar.animate ? s.slide : ""}`}
          style={{ "--bar-x": `${bar.x}px`, "--bar-w": String(bar.w) } as CSSProperties}
        />
      ) : null}
      {items.map((item, i) => {
        const selected = item.id === value;
        return (
          <button
            key={item.id}
            ref={(el) => { refs.current[i] = el; }}
            role="tab"
            type="button"
            id={`${idBase}-tab-${item.id}`}
            aria-selected={selected}
            aria-controls={`${idBase}-panel-${item.id}`}
            tabIndex={selected ? 0 : -1}
            data-track={item.track}
            className={s.tab}
            onClick={() => onChange(item.id)}
            onKeyDown={(e) => onKey(e, i)}
          >
            {item.icon ? <Icon name={item.icon} size="sm" /> : null}
            {item.label}
            {!selected && item.hint ? <span className={s.hint}>· {item.hint}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({ idBase, id, children }: { idBase: string; id: string; children: ReactNode }) {
  return (
    <div role="tabpanel" id={`${idBase}-panel-${id}`} aria-labelledby={`${idBase}-tab-${id}`} tabIndex={-1}>
      {children}
    </div>
  );
}
