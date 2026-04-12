import { useEffect, useRef } from 'react';
import { TrendingUp, CheckCircle, Clock, Film } from 'lucide-react';
import type { Summary } from '../types';

interface KPIBarProps {
  summary: Summary;
}

function animateCount(el: HTMLSpanElement, target: number, duration = 900) {
  const start = performance.now();
  const step = (now: number) => {
    const progress = Math.min((now - start) / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    el.textContent = String(Math.round(ease * target));
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export function KPIBar({ summary }: KPIBarProps) {
  const refs = {
    total: useRef<HTMLSpanElement>(null),
    delivered: useRef<HTMLSpanElement>(null),
    pending: useRef<HTMLSpanElement>(null),
    creatives: useRef<HTMLSpanElement>(null),
  };

  useEffect(() => {
    if (refs.total.current) animateCount(refs.total.current, summary.totalCampaigns);
    if (refs.delivered.current) animateCount(refs.delivered.current, summary.delivered);
    if (refs.pending.current) animateCount(refs.pending.current, summary.pending);
    if (refs.creatives.current) animateCount(refs.creatives.current, summary.totalCreatives);
  }, [summary]);

  const kpis = [
    {
      icon: <TrendingUp size={18} />,
      label: 'Total Campaigns',
      ref: refs.total,
      color: 'var(--accent-1)',
      colorBg: 'rgba(99,102,241,0.12)',
    },
    {
      icon: <CheckCircle size={18} />,
      label: 'Delivered',
      ref: refs.delivered,
      color: 'var(--green)',
      colorBg: 'var(--green-bg)',
    },
    {
      icon: <Clock size={18} />,
      label: 'In Progress',
      ref: refs.pending,
      color: 'var(--amber)',
      colorBg: 'var(--amber-bg)',
    },
    {
      icon: <Film size={18} />,
      label: 'Total Creatives',
      ref: refs.creatives,
      color: 'var(--cyan)',
      colorBg: 'var(--cyan-bg)',
    },
  ];

  return (
    <div className="kpi-bar">
      {kpis.map(({ icon, label, ref, color, colorBg }) => (
        <div className="kpi-card" key={label} style={{ '--kpi-color': color, '--kpi-bg': colorBg } as React.CSSProperties}>
          <div className="kpi-icon">{icon}</div>
          <div className="kpi-content">
            <span className="kpi-value" ref={ref}>0</span>
            <span className="kpi-label">{label}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
