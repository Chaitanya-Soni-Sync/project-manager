import { Mail, Database, Send, Info } from 'lucide-react';

interface TimelineProps {
  log: string[];
}

function classifyEvent(entry: string): {
  icon: React.ReactNode;
  color: string;
  bg: string;
  label: string;
} {
  const lower = entry.toLowerCase();
  if (lower.includes('email received') || lower.includes('received email')) {
    return { icon: <Mail size={14} />, color: '#3b82f6', bg: 'rgba(59,130,246,0.15)', label: 'Email Received' };
  }
  if (lower.includes('data') || lower.includes('log') || lower.includes('barc')) {
    return { icon: <Database size={14} />, color: '#22d3ee', bg: 'rgba(34,211,238,0.15)', label: 'Data Received' };
  }
  if (lower.includes('analysis') || lower.includes('sent') || lower.includes('delivered') || lower.includes('report')) {
    return { icon: <Send size={14} />, color: '#10b981', bg: 'rgba(16,185,129,0.15)', label: 'Delivered' };
  }
  return { icon: <Info size={14} />, color: '#8b9fc0', bg: 'rgba(139,159,192,0.12)', label: 'Event' };
}

export function Timeline({ log }: TimelineProps) {
  if (!log || log.length === 0) {
    return <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No timeline events recorded yet.</p>;
  }

  return (
    <ul className="timeline-list">
      {log.map((entry, i) => {
        const { icon, color, bg } = classifyEvent(entry);
        return (
          <li key={i} className="timeline-item" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="timeline-connector">
              <div className="timeline-icon-wrap" style={{ background: bg, color }}>
                {icon}
              </div>
              {i < log.length - 1 && <div className="timeline-line" />}
            </div>
            <div className="timeline-content">
              <p className="timeline-text">{entry}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
