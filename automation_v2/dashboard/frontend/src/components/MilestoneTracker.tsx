import { Mail, Database, CheckCircle, Clock, Send, Zap } from 'lucide-react';
import type { CampaignDetail } from '../types';

interface MilestoneTrackerProps {
  detail: CampaignDetail;
}

interface Milestone {
  key: string;
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
  bg: string;
}

const DATE_LIKE = /^\d{4}-\d{2}-\d{2}/;

function fmt(d: string | undefined): string {
  if (!d) return '—';
  // Reject non-date sentinel strings or JSON blobs
  if (d === 'Detecting...' || d === 'Live' || d.startsWith('[') || d.startsWith('{') || d.length > 40) return '—';
  if (!DATE_LIKE.test(d)) return d; // return as-is if not a date string
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return '—';
    return dt.toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return '—'; }
}

export function MilestoneTracker({ detail }: MilestoneTrackerProps) {
  const milestones: Milestone[] = [
    {
      key: 'email',
      label: 'Email Received',
      value: fmt(detail.Client_Email_Date),
      icon: <Mail size={15} />,
      color: '#3b82f6',
      bg: 'rgba(59,130,246,0.12)',
    },
    {
      key: 'nikhil',
      label: 'Nikhil Notified',
      value: fmt(detail.Nikhil_Email_Sent_Date),
      icon: <Send size={15} />,
      color: '#a78bfa',
      bg: 'rgba(167,139,250,0.12)',
    },
    {
      key: 'data',
      label: 'Data Received',
      value: fmt(detail.Data_Received_Date),
      icon: <Database size={15} />,
      color: 'var(--cyan)',
      bg: 'var(--cyan-bg)',
    },
    {
      key: 'chaitanya',
      label: 'Analysis / Last Action',
      value: fmt(detail.Chaitanya_Email_Sent_Date) !== '—'
        ? fmt(detail.Chaitanya_Email_Sent_Date)
        : (detail.Last_Step && !detail.Last_Step.includes('Delivered') ? detail.Last_Step : '—'),
      icon: <Zap size={15} />,
      color: 'var(--amber)',
      bg: 'var(--amber-bg)',
    },
    {
      key: 'delivered',
      label: 'Analysis Delivered',
      value: (() => {
        // Use Delivery_Status from registry (most reliable), not tracking blob
        const s = (detail.Delivery_Status || detail.Status || '').toLowerCase();
        if (s === 'delivered') return 'Delivered ✅';
        if (s === 'pending') return 'Pending';
        return s || 'Pending';
      })(),
      icon: <CheckCircle size={15} />,
      color: 'var(--green)',
      bg: 'var(--green-bg)',
    },
  ];

  // Determine which milestones are "done"
  const isDone = (m: Milestone) =>
    m.value && m.value !== '—' && m.value !== 'Detecting...' && m.value !== 'Pending';

  return (
    <div className="milestone-tracker">
      {/* Last step banner */}
      {detail.Last_Step && (
        <div className="last-step-banner">
          <Clock size={14} />
          <span>Last Step: <strong>{detail.Last_Step}</strong></span>
        </div>
      )}

      <div className="milestones">
        {milestones.map((m, idx) => {
          const done = isDone(m);
          const isLast = idx === milestones.length - 1;
          return (
            <div key={m.key} className={`milestone-item ${done ? 'done' : 'pending-ms'}`}>
              <div className="milestone-connector">
                <div
                  className="milestone-dot"
                  style={done ? { background: m.bg, color: m.color, border: `2px solid ${m.color}` } : {}}
                >
                  {m.icon}
                </div>
                {!isLast && <div className={`milestone-line ${done ? 'line-done' : ''}`} />}
              </div>
              <div className="milestone-content">
                <div className="milestone-label">{m.label}</div>
                <div className="milestone-value" style={done ? { color: m.color } : {}}>
                  {m.value || '—'}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Thread count info */}
      {detail.Thread_Count !== undefined && detail.Thread_Count > 1 && (
        <div className="thread-count-note">
          📎 {detail.Thread_Count} email threads tracked for this campaign
        </div>
      )}
    </div>
  );
}
