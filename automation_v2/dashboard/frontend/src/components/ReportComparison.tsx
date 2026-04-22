import { useState, useEffect } from 'react';
import type { FileEntry, ReportComparisonData } from '../types';
import { RefreshCcw, Activity } from 'lucide-react';
import './ReportComparison.css';

interface Props {
  productName: string;
  files: FileEntry[];
}

export function ReportComparison({ productName, files }: Props) {
  const [reports, setReports] = useState<Record<string, ReportComparisonData>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Filter for valid syncmedia MS Excel files
  const analysisFiles = files.filter(f => {
    const isExcel = f.name?.toLowerCase().endsWith('.xlsx') || f.name?.toLowerCase().endsWith('.csv');
    const senderStr = (f.sender || '').toLowerCase();
    const isFromSyncMedia = senderStr.includes('syncmedia');
    return isExcel && isFromSyncMedia && !!f.onedrive_id;
  });

  // Sort descending by Shared Date
  const sortedFiles = [...analysisFiles].sort((a, b) => 
    new Date(b.time || 0).getTime() - new Date(a.time || 0).getTime()
  );

  // UI State
  const [file1Id, setFile1Id] = useState<string>('');
  const [file2Id, setFile2Id] = useState<string>('');
  const [compareMode, setCompareMode] = useState<boolean>(false);
  const [activeSheetNum, setActiveSheetNum] = useState<number>(0);

  // Initialize selected files
  useEffect(() => {
    if (sortedFiles.length > 0 && !file1Id) {
      setFile1Id(sortedFiles[0].onedrive_id!);
      if (sortedFiles.length > 1) {
        setFile2Id(sortedFiles[1].onedrive_id!);
      }
    }
  }, [sortedFiles, file1Id]);

  useEffect(() => {
    const fetchReports = async () => {
      const idsToFetch = [file1Id, compareMode ? file2Id : null].filter(Boolean) as string[];
      if (idsToFetch.length === 0) return;

      // Filter out already fetched
      const missingIds = idsToFetch.filter(id => !reports[id]);
      if (missingIds.length === 0) return;

      setLoading(true);
      setError(null);
      try {
        const queryIds = missingIds.join(',');
        const response = await fetch(`http://localhost:5001/api/campaign/${encodeURIComponent(productName)}/compare?ids=${queryIds}`);
        if (!response.ok) throw new Error('Failed to fetch analysis data');
        
        const data: ReportComparisonData[] = await response.json();
        setReports(prev => {
          const next = { ...prev };
          data.forEach(r => next[r.onedrive_id] = r);
          return next;
        });

      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
  }, [file1Id, file2Id, compareMode, productName, reports]);

  if (analysisFiles.length === 0) {
    return null; // Don't show component if no analysis deliverables are found
  }

  const renderTable = (reportId: string, titleLabel: string) => {
    const reportData = reports[reportId];
    if (!reportData) return <div className="loading-state"><RefreshCcw className="spinner" /> Loading Data...</div>;
    if (reportData.error) return <div className="error-message">Error: {reportData.error}</div>;

    const sheet = reportData.sheets[activeSheetNum] || reportData.sheets[0];
    if (!sheet) return <div className="error-message">No valid datatables inside file.</div>;

    // Find max width of the table
    let maxCols = 0;
    const cleanData = sheet.rawData || [];
    cleanData.forEach(r => {
      if (r && r.length > maxCols) maxCols = r.length;
    });

    return (
      <div className="viewer-grid-box fade-in">
        <div className="viewer-grid-header">
           <span className="viewer-grid-title">{titleLabel}</span>
           <span className="viewer-grid-date">{new Date(reportData.time).toLocaleString()}</span>
        </div>
        <div className="table-responsive viewer-table-wrapper">
          <table className="campaign-table raw-excel-table">
            <tbody>
              {cleanData.map((rowArr, rIdx) => {
                // Ensure array fills maxCols so borders draw correctly
                const cells = Array.from({ length: maxCols }, (_, i) => rowArr[i]);
                return (
                  <tr key={rIdx}>
                    {cells.map((cell, cIdx) => (
                      <td key={cIdx}>
                        {cell !== undefined && cell !== null ? String(cell) : ''}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // Determine common sheets across both files (if comparing) to render bottom tabs safely
  let availableSheets: string[] = [];
  if (reports[file1Id] && reports[file1Id].sheets) {
    availableSheets = reports[file1Id].sheets.map(s => s.name);
  }
  if (compareMode && reports[file2Id] && reports[file2Id].sheets) {
    // Take minimum common sheets or just use primary file's sheets
    const primaryCount = reports[file1Id]?.sheets?.length || 0;
    const secondaryCount = reports[file2Id]?.sheets?.length || 0;
    const minCount = Math.min(primaryCount, secondaryCount);
    availableSheets = (reports[file1Id]?.sheets?.slice(0, minCount) || []).map(s => s.name);
  }

  return (
    <div className="report-comparison-container glass-panel analysis-viewer">
      
      {/* Excel Top Controls */}
      <div className="excel-controls-header">
        <div className="excel-title">
          <h3><Activity className="icon" /> Analysis Viewer</h3>
          <p className="subtitle">Select deliverables shared by SyncMedia (@syncmedia.io) to review raw data.</p>
        </div>

        <div className="viewer-actions">
          <div className="dropdown-group">
            <label>Select Report</label>
            <select 
              className="excel-dropdown"
              value={file1Id} 
              onChange={e => {
                setFile1Id(e.target.value);
                setActiveSheetNum(0);
              }}
            >
              {sortedFiles.map(f => (
                <option key={f.onedrive_id} value={f.onedrive_id}>
                   {new Date(f.time!).toLocaleDateString('en-GB')} — {f.name}
                </option>
              ))}
            </select>
          </div>

          <div className="dropdown-group checkbox-group">
             <label className="checkbox-label">
                <input 
                  type="checkbox" 
                  checked={compareMode}
                  onChange={e => {
                     setCompareMode(e.target.checked);
                     setActiveSheetNum(0);
                  }}
                  disabled={sortedFiles.length < 2}
                />
                Compare with...
             </label>
             {compareMode && (
                <select 
                  className="excel-dropdown"
                  value={file2Id} 
                  onChange={e => {
                    setFile2Id(e.target.value);
                    setActiveSheetNum(0);
                  }}
                >
                  {sortedFiles.map(f => (
                    <option key={f.onedrive_id} value={f.onedrive_id} disabled={f.onedrive_id === file1Id}>
                      {new Date(f.time!).toLocaleDateString('en-GB')} — {f.name}
                    </option>
                  ))}
                </select>
             )}
          </div>
        </div>
      </div>

      {error ? (
        <div className="error-message">Error: {error}</div>
      ) : loading && Object.keys(reports).length === 0 ? (
        <div className="loading-state">
           <RefreshCcw className="spinner" /> 
           <p>Initializing Analysis Environment...</p>
        </div>
      ) : (
        <div className="viewer-body">
          {/* Main Data Render Area */}
          <div className={`viewer-stacks ${compareMode ? 'compare-active' : ''}`}>
             {renderTable(file1Id, "Primary Output")}
             {compareMode && file2Id && renderTable(file2Id, "Secondary Output (Comparison)")}
          </div>

          {/* Excel Bottom Tabs */}
          <div className="excel-bottom-bar">
            <div className="tab-scroll-area">
              {availableSheets.map((sheetName, index) => (
                <button
                  key={index}
                  className={`bottom-tab ${activeSheetNum === index ? 'active' : ''}`}
                  onClick={() => setActiveSheetNum(index)}
                >
                  {sheetName}
                </button>
              ))}
            </div>
            <div className="tab-spacer"></div>
          </div>
        </div>
      )}
    </div>
  );
}
