interface StatusPillProps {
  tone?: "neutral" | "accent" | "warning" | "danger";
  children: string;
}

export const StatusPill = ({ tone = "neutral", children }: StatusPillProps) => (
  <span className={`status-pill status-pill--${tone}`}>{children}</span>
);

