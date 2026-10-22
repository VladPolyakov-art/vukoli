import s from "./Spinner.module.css";

export interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  /** Visible text next to the spinner. Without it, provide `srLabel`. */
  label?: string;
  srLabel?: string;
}

export function Spinner({ size = "md", label, srLabel }: SpinnerProps) {
  const ring = <span className={`${s.spinner} ${size !== "md" ? s[size] : ""} motion-loop`} aria-hidden="true" />;
  if (label) {
    return (
      <span className={s.row} role="status">
        {ring}
        <span>{label}</span>
      </span>
    );
  }
  return (
    <span role="status" className={s.row}>
      {ring}
      {srLabel ? <span className="visually-hidden">{srLabel}</span> : null}
    </span>
  );
}
