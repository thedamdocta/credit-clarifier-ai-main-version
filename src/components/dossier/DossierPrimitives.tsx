import React from "react";
import { cn } from "@/lib/utils";

export const DossierPageHeader: React.FC<{
  eyebrow?: string;
  title: string;
  badge?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  compact?: boolean;
}> = ({ eyebrow, title, badge, subtitle, actions, className, compact }) => (
  <header className={cn("dossier-page-header", compact && "compact", className)}>
    <div className="space-y-3">
      {eyebrow ? <div className="dossier-eyebrow">{eyebrow}</div> : null}
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="dossier-display-title">{title}</h1>
        {badge}
      </div>
      {subtitle ? <div className="dossier-subtitle">{subtitle}</div> : null}
    </div>
    {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
  </header>
);

export const DossierSection: React.FC<{
  className?: string;
  children: React.ReactNode;
}> = ({ className, children }) => <section className={cn("dossier-section", className)}>{children}</section>;

export const DossierSectionHeader: React.FC<{
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}> = ({ title, description, actions }) => (
  <div className="dossier-section-header">
    <div className="space-y-2">
      <h2 className="dossier-section-title">{title}</h2>
      {description ? <p className="max-w-3xl text-sm leading-7 text-slate-500">{description}</p> : null}
    </div>
    {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
  </div>
);

export const DossierMetaTable: React.FC<{
  rows: Array<{ label: string; value: React.ReactNode; valueClassName?: string }>;
}> = ({ rows }) => (
  <div className="dossier-kv-table">
    {rows.map((row) => (
      <div key={row.label} className="dossier-kv-row">
        <div className="dossier-kv-label">{row.label}</div>
        <div className={cn("dossier-kv-value normal", row.valueClassName)}>{row.value}</div>
      </div>
    ))}
  </div>
);

export const DossierMetaStack: React.FC<{
  rows: Array<{ label: string; value: React.ReactNode }>;
}> = ({ rows }) => (
  <div className="dossier-meta-stack">
    {rows.map((row) => (
      <div key={row.label} className="dossier-meta-stack-row">
        <div className="dossier-meta-stack-label">{row.label}</div>
        <div className="dossier-meta-stack-value">{row.value}</div>
      </div>
    ))}
  </div>
);

export const DossierEmptyState: React.FC<{
  title: string;
  description: React.ReactNode;
  action?: React.ReactNode;
}> = ({ title, description, action }) => (
  <div className="dossier-empty-state">
    <div className="space-y-3">
      <h3 className="dossier-empty-title">{title}</h3>
      <div className="max-w-2xl text-sm leading-7 text-slate-500">{description}</div>
    </div>
    {action ? <div className="mt-8">{action}</div> : null}
  </div>
);
