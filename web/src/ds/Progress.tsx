/* Progress (D85): a thin bar for a long job with a known share done (the Ollama model download). Without `value`
 * it is indeterminate: a short segment sweeps the track (still under reduced motion). The visible numbers
 * ("1.2 of 5.2 GB") are the caller's; `valueText` says the same to a screen reader. */
import s from "./Progress.module.css";

export interface ProgressProps {
  /** 0–1. Leave out while the size isn't known yet. */
  value?: number;
  label: string;
  valueText?: string;
}

export function Progress({ value, label, valueText }: ProgressProps) {
  const known = value !== undefined && Number.isFinite(value);
  const share = known ? Math.min(1, Math.max(0, value)) : 0;
  return (
    <div className={s.track} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100}
      aria-valuenow={known ? Math.round(share * 100) : undefined} aria-valuetext={valueText}>
      <span className={`${s.fill} ${known ? "" : `${s.sweep} motion-loop`}`} style={known ? { width: `${share * 100}%` } : undefined} />
    </div>
  );
}
