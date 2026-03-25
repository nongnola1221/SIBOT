import type { PropsWithChildren, ReactNode } from "react";

interface SectionCardProps extends PropsWithChildren {
  title: string;
  eyebrow?: string;
  actions?: ReactNode;
}

export const SectionCard = ({ title, eyebrow, actions, children }: SectionCardProps) => (
  <section className="section-card">
    <header className="section-card__header">
      <div>
        {eyebrow ? <p className="section-card__eyebrow">{eyebrow}</p> : null}
        <h2>{title}</h2>
      </div>
      {actions ? <div className="section-card__actions">{actions}</div> : null}
    </header>
    <div className="section-card__body">{children}</div>
  </section>
);

