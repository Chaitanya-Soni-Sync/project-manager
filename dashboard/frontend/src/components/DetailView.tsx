import { ArrowLeft, FolderOpen, Activity, Play, Calendar, FileText, BarChart2, Clock, Film, ListChecks, ScrollText } from 'lucide-react';
import type { CampaignDetail } from '../types';
import { MetricsPanel } from './MetricsPanel';
import { Timeline } from './Timeline';
import { DetailLoader } from './Loader';
import { CreativePanel } from './CreativePanel';
import { MilestoneTracker } from './MilestoneTracker';

interface DetailViewProps {
  detail: CampaignDetail | null;
  loading: boolean;
  onBack: () => void;
}

function formatDate(str: string | undefined): string {
  if (!str || str === 'Detecting...' || str === 'Live') return str || 'TBD';
  try {
    return new Date(str).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch { return str; }
}

function getStatus(d: CampaignDetail) {
  const s = (d.Delivery_Status || d.Status || d.Analysis_Delivered_Status || '').toLowerCase();
  if (s === 'delivered') return { label: 'Delivered', cls: 'badge-delivered' };
  if (s === 'pending')   return { label: 'In Progress', cls: 'badge-pending' };
  return { label: d.Delivery_Status || d.Status || 'Unknown', cls: 'badge-unknown' };
}

function fmtImp(n: number) {
  if (!n) return 'TBD';
  if (n >= 10_000_000) return `${(n / 10_000_000).toFixed(2)} Cr`;
  if (n >= 100_000)    return `${(n / 100_000).toFixed(2)} L`;
  if (n >= 1_000)      return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// Check if a string is a real HTTP URL
function isUrl(str: string | undefined): boolean {
  if (!str) return false;
  return str.startsWith('http://') || str.startsWith('https://');
}

export function DetailView({ detail, loading, onBack }: DetailViewProps) {
  if (loading) return (
    <div className="detail-view">
      <button className="back-btn" onClick={onBack}>
        <ArrowLeft size={16} /> Back to Overview
      </button>
      <DetailLoader />
    </div>
  );

  if (!detail) return null;

  const { label, cls } = getStatus(detail);
  const folderLink = detail.OneDrive_Folder_Name || detail.OneDrive_Folder_Link || '';
  const hasUrl = isUrl(folderLink);

  const totalImp = detail.Metrics?.reduce((s, m) => {
    const n = parseFloat((m.Impressions || m.TAM || '0').replace(/[^0-9.]/g, ''));
    return s + (isNaN(n) ? 0 : n);
  }, 0) || 0;
  const primaryMetric = detail.Metrics?.[0];

  // Build activity log from History_Log (array of timestamped strings)
  const activityLog = detail.History_Log?.filter(Boolean) || [];

  return (
    <div className="detail-view">
      {/* ── Back nav ── */}
      <button className="back-btn" onClick={onBack}>
        <ArrowLeft size={16} /> Back to Overview
      </button>

      {/* ── Campaign Header ── */}
      <div className="detail-header">
        <div className="detail-title-row">
          <h2 className="detail-title">{detail.Product_Name}</h2>
          <span className={`status-badge ${cls}`}>
            <span className="status-dot" />
            {label}
          </span>
        </div>

        <div className="detail-meta">
          {detail.Brand && (
            <span className="detail-meta-item">
              <Activity size={13} /> {detail.Brand}
            </span>
          )}
          {detail.Category && (
            <span className="detail-meta-item">
              <FileText size={13} /> {detail.Category}
            </span>
          )}
          {detail.Media_Platforms && (
            <span className="detail-meta-item">
              <BarChart2 size={13} /> {detail.Media_Platforms}
            </span>
          )}

          {/* OneDrive folder — URL opens externally, folder name shows as label */}
          {folderLink && hasUrl ? (
            <a
              href={folderLink}
              target="_blank"
              rel="noreferrer noopener"
              className="onedrive-btn"
              onClick={e => e.stopPropagation()}
            >
              <FolderOpen size={14} /> Open OneDrive
            </a>
          ) : folderLink ? (
            <span className="onedrive-folder-label">
              <FolderOpen size={13} /> {folderLink}
            </span>
          ) : null}
        </div>
      </div>

      {/* ── Top KPI Cards ── */}
      <div className="detail-kpis">
        <div className="detail-kpi-card">
          <div className="detail-kpi-icon" style={{ color: 'var(--accent-1)', background: 'rgba(99,102,241,0.12)' }}>
            <Activity size={20} />
          </div>
          <div>
            <div className="detail-kpi-val">{fmtImp(totalImp)}</div>
            <div className="detail-kpi-label">Total Impressions</div>
          </div>
        </div>
        <div className="detail-kpi-card">
          <div className="detail-kpi-icon" style={{ color: 'var(--cyan)', background: 'var(--cyan-bg)' }}>
            <Play size={20} />
          </div>
          <div>
            <div className="detail-kpi-val">{primaryMetric?.LTV_Spots || '—'}</div>
            <div className="detail-kpi-label">LTV Spots</div>
          </div>
        </div>
        <div className="detail-kpi-card">
          <div className="detail-kpi-icon" style={{ color: 'var(--green)', background: 'var(--green-bg)' }}>
            <Calendar size={20} />
          </div>
          <div>
            <div className="detail-kpi-val" style={{ fontSize: '0.9rem' }}>
              {formatDate(primaryMetric?.Start_Date)} → {formatDate(primaryMetric?.End_Date)}
            </div>
            <div className="detail-kpi-label">Date Range</div>
          </div>
        </div>
        <div className="detail-kpi-card">
          <div className="detail-kpi-icon" style={{ color: 'var(--amber)', background: 'var(--amber-bg)' }}>
            <Film size={20} />
          </div>
          <div>
            <div className="detail-kpi-val">{detail.Creative_Count || detail.Creatives?.length || '—'}</div>
            <div className="detail-kpi-label">Total Creatives</div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          ROW 1: Milestone Tracker + Media Impressions
          ══════════════════════════════════════════════════ */}
      <div className="detail-columns-2">
        <div className="detail-section">
          <div className="section-heading">
            <ListChecks size={16} />
            <h4>Campaign Milestones</h4>
          </div>
          <MilestoneTracker detail={detail} />
        </div>

        <div className="detail-section">
          <div className="section-heading">
            <BarChart2 size={16} />
            <h4>Media Impressions</h4>
          </div>
          <MetricsPanel metrics={detail.Metrics} />
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          ROW 2: Creative Info (full width)
          ══════════════════════════════════════════════════ */}
      <div className="detail-section" style={{ marginTop: '1.5rem' }}>
        <div className="section-heading">
          <Film size={16} />
          <h4>Creative Intelligence — Media Mapping &amp; Pitch Levels</h4>
        </div>
        <CreativePanel
          mediaMappings={detail.Media_Mappings || []}
          pitchLevels={detail.Pitch_Levels || []}
          totalDurationSec={detail.Total_Duration_Sec || 0}
          creativeCount={detail.Creative_Count || ''}
        />
      </div>

      {/* ══════════════════════════════════════════════════
          ROW 3: Activity Log + Files Received
          ══════════════════════════════════════════════════ */}
      <div className="detail-columns-2" style={{ marginTop: '1.5rem' }}>
        {/* Activity Log */}
        <div className="detail-section">
          <div className="section-heading">
            <ScrollText size={16} />
            <h4>Activity Log</h4>
            {activityLog.length > 0 && (
              <span className="section-badge">{activityLog.length}</span>
            )}
          </div>
          <Timeline log={activityLog} />
        </div>

        {/* Files Received */}
        {detail.All_Files_Data && detail.All_Files_Data.length > 0 && (
          <div className="detail-section">
            <div className="section-heading">
              <FileText size={16} />
              <h4>Files Received</h4>
              <span className="section-badge">{detail.All_Files_Data.length}</span>
            </div>
            <div className="table-wrapper">
              <table className="assets-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>File Name</th>
                    <th>From</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.All_Files_Data.map((f, i) => (
                    <tr key={i}>
                      <td style={{ color: 'var(--text-muted)', width: '32px' }}>{i + 1}</td>
                      <td>
                        <span className="filename-cell" title={f.name}>
                          {f.name && f.name.length > 40 ? f.name.slice(0, 38) + '…' : (f.name || '—')}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                        {/* Extract just the name part from "Name <email>" */}
                        {(f.sender || '').replace(/<[^>]+>/, '').trim() || '—'}
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                        {f.time ? new Date(f.time).toLocaleDateString('en-IN', {
                          day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                        }) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
