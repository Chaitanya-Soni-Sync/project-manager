import { Film, Clock, Globe, Tag, CheckCircle, Layers } from 'lucide-react';
import type { MediaMapping } from '../types';

interface CreativePanelProps {
  mediaMappings: MediaMapping[];
  pitchLevels: string[];
  totalDurationSec: number;
  creativeCount: string;
}

function formatDuration(totalSec: number): string {
  if (!totalSec) return '—';
  const mins = Math.floor(totalSec / 60);
  const secs = Math.round(totalSec % 60);
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

function getPitchLabel(p: string): string {
  const n = parseFloat(p);
  if (isNaN(n) || n === 0) return 'Original';
  return n > 0 ? `+${n} (JHS-CTV)` : `${n} (Mobile/OTT)`;
}

function getPitchColor(p: string) {
  const n = parseFloat(p);
  if (isNaN(n) || n === 0) return { color: 'var(--text-muted)', bg: 'rgba(139,159,192,0.1)' };
  if (n > 0) return { color: 'var(--cyan)', bg: 'var(--cyan-bg)' };
  return { color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' };
}

function getStatusColor(status: string) {
  const s = (status || '').toLowerCase();
  if (s === 'uploaded' || s === 'done') return 'var(--green)';
  if (s === 'pending') return 'var(--amber)';
  return 'var(--text-muted)';
}

export function CreativePanel({ mediaMappings, pitchLevels, totalDurationSec, creativeCount }: CreativePanelProps) {
  const totalFiles = mediaMappings.reduce((s, m) => s + m.files.length, 0);

  return (
    <div className="creative-panel">
      {/* ── Quick stats row ── */}
      <div className="creative-stats-row">
        <div className="creative-stat">
          <div className="creative-stat-icon" style={{ color: 'var(--accent-1)', background: 'rgba(99,102,241,0.12)' }}>
            <Film size={16} />
          </div>
          <div>
            <div className="creative-stat-val">{creativeCount || totalFiles}</div>
            <div className="creative-stat-label">Total Creatives</div>
          </div>
        </div>
        <div className="creative-stat">
          <div className="creative-stat-icon" style={{ color: 'var(--cyan)', background: 'var(--cyan-bg)' }}>
            <Clock size={16} />
          </div>
          <div>
            <div className="creative-stat-val">{formatDuration(totalDurationSec)}</div>
            <div className="creative-stat-label">Total Duration</div>
          </div>
        </div>
        <div className="creative-stat">
          <div className="creative-stat-icon" style={{ color: '#a78bfa', background: 'rgba(167,139,250,0.12)' }}>
            <Layers size={16} />
          </div>
          <div>
            <div className="creative-stat-val">{mediaMappings.length}</div>
            <div className="creative-stat-label">Media Channels</div>
          </div>
        </div>
        <div className="creative-stat">
          <div className="creative-stat-icon" style={{ color: 'var(--amber)', background: 'var(--amber-bg)' }}>
            <Tag size={16} />
          </div>
          <div>
            <div className="creative-stat-val">{pitchLevels.length}</div>
            <div className="creative-stat-label">Pitch Variants</div>
          </div>
        </div>
      </div>

      {/* ── Pitch levels ── */}
      {pitchLevels.length > 0 && (
        <div className="pitch-row">
          <span className="pitch-row-label">Pitch Levels:</span>
          <div className="pitch-tags">
            {pitchLevels.map(p => {
              const { color, bg } = getPitchColor(p);
              return (
                <span key={p} className="pitch-tag" style={{ color, background: bg, border: `1px solid ${color}33` }}>
                  {getPitchLabel(p)}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Media Mapping Table ── */}
      {mediaMappings.map(({ media, files }) => (
        <div key={media} className="media-mapping-block">
          <div className="media-mapping-header">
            <Globe size={13} />
            <span className="media-mapping-title">{media}</span>
            <span className="media-mapping-count">{files.length} creative{files.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="table-wrapper">
            <table className="assets-table">
              <thead>
                <tr>
                  <th>File Name</th>
                  <th>Duration</th>
                  <th>Pitch</th>
                  <th>Language</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {files.map((f, i) => (
                  <tr key={i}>
                    <td>
                      <span className="filename-cell" title={f.file}>
                        {f.file.length > 55 ? f.file.slice(0, 52) + '…' : f.file}
                      </span>
                    </td>
                    <td style={{ color: 'var(--cyan)', fontWeight: 600 }}>
                      {f.duration ? `${f.duration}s` : '—'}
                    </td>
                    <td>
                      {f.pitch !== undefined && (
                        <span className="pitch-mini" style={{ color: getPitchColor(f.pitch).color }}>
                          {getPitchLabel(f.pitch)}
                        </span>
                      )}
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{f.language || '—'}</td>
                    <td>
                      {f.status && (
                        <span style={{ color: getStatusColor(f.status), fontSize: '0.75rem', fontWeight: 600 }}>
                          {f.status === 'uploaded' && <CheckCircle size={11} style={{ marginRight: 4, display: 'inline' }} />}
                          {f.status}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {mediaMappings.length === 0 && (
        <div className="metrics-empty">
          <Film size={28} style={{ opacity: 0.2 }} />
          <p>No creative data available for this campaign.</p>
        </div>
      )}
    </div>
  );
}
