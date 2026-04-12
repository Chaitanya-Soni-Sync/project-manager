import type { MetricEntry } from '../types';
import { BarChart2 } from 'lucide-react';

interface MetricsPanelProps {
  metrics: MetricEntry[];
}

function formatNumber(val: string | undefined): string {
  if (!val) return '—';
  const n = parseFloat(val.replace(/[^0-9.]/g, ''));
  if (isNaN(n)) return val;
  if (n >= 10_000_000) return `${(n / 10_000_000).toFixed(2)} Cr`;
  if (n >= 100_000)    return `${(n / 100_000).toFixed(2)} L`;
  if (n >= 1_000)      return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function MetricsPanel({ metrics }: MetricsPanelProps) {
  if (!metrics || metrics.length === 0) {
    return (
      <div className="metrics-empty">
        <BarChart2 size={32} style={{ opacity: 0.2 }} />
        <p>No metrics data available yet.</p>
      </div>
    );
  }

  // Aggregate impression totals per platform (using Media_Platform column or similar)
  const platformMap: Record<string, number> = {};
  let grandTotal = 0;

  metrics.forEach(m => {
    const platform = m.Media_Platform || m.Platform || 'Unknown';
    // Try multiple columns that might contain impressions
    const impStr = m.Impressions || m.TAM || m.YouTube || '0';
    const imp = parseFloat(impStr.replace(/[^0-9.]/g, '')) || 0;
    platformMap[platform] = (platformMap[platform] || 0) + imp;
    grandTotal += imp;
  });

  const platforms = Object.entries(platformMap).sort((a, b) => b[1] - a[1]);
  const maxVal = platforms[0]?.[1] || 1;

  const barColors = [
    'var(--accent-1)',
    'var(--cyan)',
    'var(--green)',
    'var(--amber)',
    '#a78bfa',
    '#fb7185',
  ];

  return (
    <div className="metrics-panel">
      <div className="metrics-total-row">
        <span className="metrics-total-label">Total Impressions</span>
        <span className="metrics-total-val">{formatNumber(String(grandTotal))}</span>
      </div>

      <div className="metrics-bars">
        {platforms.map(([platform, value], i) => {
          const pct = (value / maxVal) * 100;
          return (
            <div key={platform} className="metric-row">
              <div className="metric-platform-name">{platform}</div>
              <div className="metric-bar-track">
                <div
                  className="metric-bar-fill"
                  style={{
                    width: `${pct}%`,
                    background: barColors[i % barColors.length],
                    animationDelay: `${i * 100}ms`,
                  }}
                />
              </div>
              <div className="metric-bar-value">{formatNumber(String(value))}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
