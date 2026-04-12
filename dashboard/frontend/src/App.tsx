import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import { Search, RefreshCw, Zap, X } from 'lucide-react'
import './App.css'
import { KPIBar } from './components/KPIBar'
import { CampaignCard } from './components/CampaignCard'
import { DetailView } from './components/DetailView'
import { Loader } from './components/Loader'
import type { Campaign, CampaignDetail, Summary } from './types'

const API = 'http://localhost:5001/api'

type FilterTab = 'all' | 'delivered' | 'pending'

const DEFAULT_SUMMARY: Summary = {
  totalCampaigns: 0, delivered: 0, pending: 0, totalCreatives: 0, activeThreads: 0,
}

function App() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [summary, setSummary] = useState<Summary>(DEFAULT_SUMMARY)
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null)
  const [detail, setDetail] = useState<CampaignDetail | null>(null)
  const [loadingCampaigns, setLoadingCampaigns] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterTab>('all')
  const [refreshing, setRefreshing] = useState(false)

  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setLoadingCampaigns(true)
    else setRefreshing(true)
    setError(null)
    try {
      const [campRes, sumRes] = await Promise.allSettled([
        axios.get<Campaign[]>(`${API}/campaigns`),
        axios.get<Summary>(`${API}/summary`),
      ])
      if (campRes.status === 'fulfilled') setCampaigns(campRes.value.data)
      if (sumRes.status === 'fulfilled') setSummary(sumRes.value.data)
    } catch (e: unknown) {
      setError(axios.isAxiosError(e)
        ? 'Backend unreachable — is the server running on port 5001?'
        : 'Failed to load campaigns')
    } finally {
      setLoadingCampaigns(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const fetchDetail = async (productName: string) => {
    setLoadingDetail(true)
    setDetail(null)
    try {
      const res = await axios.get<CampaignDetail>(`${API}/campaign/${encodeURIComponent(productName)}`)
      setDetail(res.data)
    } catch {
      setDetail(null)
    } finally {
      setLoadingDetail(false)
    }
  }

  const handleCardClick = (c: Campaign) => {
    setSelectedProduct(c.Product_Name)
    fetchDetail(c.Product_Name)
  }

  const handleBack = () => {
    setSelectedProduct(null)
    setDetail(null)
  }

  // ── Filtered campaigns ──────────────────────────────────────────────────────
  const filtered = campaigns.filter(c => {
    const matchSearch = (c.Product_Name || '').toLowerCase().includes(search.toLowerCase())
      || (c.Media_Platforms || '').toLowerCase().includes(search.toLowerCase())
      || (c.Brand || '').toLowerCase().includes(search.toLowerCase())
    const status = (c.Delivery_Status || c.Status || '').toLowerCase()
    const matchFilter = filter === 'all' ? true
      : filter === 'delivered' ? status === 'delivered'
      : status === 'pending'
    return matchSearch && matchFilter
  })

  return (
    <div className="app">
      {/* ══ Global Header ══════════════════════════════════════════════════════ */}
      <header className="app-header">
        <div className="header-brand">
          <div className="brand-logo"><Zap size={20} /></div>
          <div>
            <h1 className="brand-title">Campaign Visibility Portal</h1>
            <p className="brand-sub">JHS × SYNC — Live Campaign Intelligence</p>
          </div>
        </div>
        <button
          className={`refresh-btn ${refreshing ? 'spinning' : ''}`}
          onClick={() => fetchAll(true)}
          title="Refresh data"
          disabled={refreshing}
        >
          <RefreshCw size={16} />
        </button>
      </header>

      <main className="app-main">
        {selectedProduct ? (
          /* ══ DETAIL VIEW ══════════════════════════════════════════════════ */
          <DetailView
            detail={detail}
            loading={loadingDetail}
            onBack={handleBack}
          />
        ) : (
          /* ══ OVERVIEW ════════════════════════════════════════════════════ */
          <>
            <KPIBar summary={summary} />

            <div className="toolbar">
              <div className="search-wrap">
                <Search size={16} className="search-icon" />
                <input
                  className="search-input"
                  type="text"
                  placeholder="Search campaigns, brands, platforms…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
                {search && (
                  <button className="search-clear" onClick={() => setSearch('')}>
                    <X size={14} />
                  </button>
                )}
              </div>
              <div className="filter-tabs">
                {(['all', 'delivered', 'pending'] as FilterTab[]).map(tab => (
                  <button
                    key={tab}
                    className={`filter-tab ${filter === tab ? 'active' : ''}`}
                    onClick={() => setFilter(tab)}
                  >
                    {tab === 'all' ? 'All' : tab === 'delivered' ? 'Delivered' : 'In Progress'}
                    {tab !== 'all' && (
                      <span className="tab-count">
                        {tab === 'delivered' ? summary.delivered : summary.pending}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="error-banner">
                <span>⚠️ {error}</span>
                <button onClick={() => fetchAll()}>Try Again</button>
              </div>
            )}

            {loadingCampaigns ? (
              <Loader />
            ) : filtered.length === 0 ? (
              <div className="empty-state">
                <p>No campaigns found{search ? ` for "${search}"` : ''}.</p>
                {search && <button className="reset-btn" onClick={() => setSearch('')}>Clear Search</button>}
              </div>
            ) : (
              <>
                <p className="results-count">
                  Showing {filtered.length} of {campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''}
                </p>
                <div className="campaign-grid">
                  {filtered.map((c, i) => (
                    <CampaignCard
                      key={c.Product_Name || i}
                      campaign={c}
                      onClick={() => handleCardClick(c)}
                      index={i}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </main>

      <footer className="app-footer">
        <span>JHS × SYNC Campaign Portal</span>
        <span className="footer-dot">·</span>
        <span>Google Sheets Live Sync</span>
        <span className="footer-dot">·</span>
        <span>Auto-updated every 15 min</span>
      </footer>
    </div>
  )
}

export default App
