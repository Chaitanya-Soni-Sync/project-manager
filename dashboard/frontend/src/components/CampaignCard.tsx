import { ExternalLink, Film, Layers } from 'lucide-react';
import type { Campaign } from '../types';

interface CampaignCardProps {
  campaign: Campaign;
  onClick: () => void;
  index: number;
}

function getPlatformBadges(platforms: string) {
  if (!platforms) return [];
  return platforms.split(/[,;|\/]/).map(p => p.trim()).filter(Boolean);
}

function getStatusMeta(status: string) {
  const s = (status || '').toLowerCase();
  if (s === 'delivered') return { label: 'Delivered', cls: 'badge-delivered', dot: true };
  if (s === 'pending')   return { label: 'In Progress', cls: 'badge-pending', dot: true };
  return { label: status || 'Unknown', cls: 'badge-unknown', dot: false };
}

export function CampaignCard({ campaign, onClick, index }: CampaignCardProps) {
  const statusRaw = campaign.Delivery_Status || campaign.Status || '';
  const { label, cls, dot } = getStatusMeta(statusRaw);
  const platforms = getPlatformBadges(campaign.Media_Platforms || campaign.Platform || '');
  const creativeCount = campaign.Creative_Count || '0';
  const isDelivered = label === 'Delivered';

  return (
    <div
      className="campaign-card"
      onClick={onClick}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* Gradient accent top bar */}
      <div className={`card-accent-bar ${isDelivered ? 'accent-delivered' : 'accent-pending'}`} />

      <div className="card-header">
        <span className={`status-badge ${cls}`}>
          {dot && <span className="status-dot" />}
          {label}
        </span>
        <div className="card-actions">
          {campaign.OneDrive_Folder_Link && (
            <a
              href={campaign.OneDrive_Folder_Link}
              target="_blank"
              rel="noreferrer"
              className="icon-btn"
              title="Open OneDrive Folder"
              onClick={e => e.stopPropagation()}
            >
              <ExternalLink size={14} />
            </a>
          )}
        </div>
      </div>

      <h3 className="card-title">{campaign.Product_Name || 'Unnamed Campaign'}</h3>

      {platforms.length > 0 && (
        <div className="platform-tags">
          {platforms.slice(0, 3).map(p => (
            <span key={p} className="platform-tag">{p}</span>
          ))}
          {platforms.length > 3 && (
            <span className="platform-tag platform-tag-more">+{platforms.length - 3}</span>
          )}
        </div>
      )}

      <div className="card-footer">
        <div className="card-stat">
          <Film size={13} />
          <span>{creativeCount} Creatives</span>
        </div>
        {campaign.Duration && (
          <div className="card-stat">
            <Layers size={13} />
            <span>{campaign.Duration}</span>
          </div>
        )}
        {campaign.Last_Sync && (
          <span className="card-date">
            {new Date(campaign.Last_Sync).toLocaleDateString('en-IN', {
              day: '2-digit', month: 'short', year: 'numeric',
            })}
          </span>
        )}
      </div>

      <div className="card-shine" />
    </div>
  );
}
