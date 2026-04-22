const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const axios = require('axios');
const xlsx = require('xlsx');

// Load .env from automation_v2 or root
dotenv.config({ path: path.join(__dirname, '../../.env') });
if (!process.env.LOGGING_SHEET_ID) {
    dotenv.config({ path: path.join(__dirname, '../../../.env') });
}

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

// ── Google Sheets Auth (OAuth2 with refresh token) ──────────────────────────
const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'http://localhost'
);
oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });

const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
const SHEET_ID        = process.env.LOGGING_SHEET_ID;
const CREATIVE_SHEET  = process.env.CREATIVE_TRACKING_SHEET_ID;

// ── Helpers ─────────────────────────────────────────────────────────────────
function rowsToObjects(rows) {
    if (!rows || rows.length <= 1) return [];
    const headers = rows[0];
    return rows.slice(1).map(row => {
        const entry = {};
        headers.forEach((h, i) => { entry[h] = row[i] !== undefined ? row[i] : ''; });
        return entry;
    });
}

function safeParseJSON(str, fallback = []) {
    try { 
        if (!str) return fallback;
        return JSON.parse(str); 
    } catch { return fallback; }
}

function isFuzzyMatch(a, b) {
    if (!a || !b) return false;
    return a.toLowerCase().includes(b.toLowerCase()) || b.toLowerCase().includes(a.toLowerCase());
}

function parseSurgicalValue(val) {
    if (!val) return { date: '', value: '' };
    const parts = String(val).split('|');
    return { date: parts[0].trim(), value: parts[1] ? parts[1].trim() : '' };
}

function parseTrackingRow(row) {
    if (!row || row.length < 3) return null;
    const obj = {
        Campaign_ID:      row[0] || '',
        Thread_ID:        row[1] || '',
        Product_Name:     row[2] || '',
        Client_Email_Date: row[3] || '',
        Media_Platforms:   row[4] || '',
        Creative_Count:    row[5] || '',
        Last_Action:       row[6] || '',
        Status:            row[7] || '',
        All_Files_Data:    safeParseJSON(row[8], []),
        History_Log:       safeParseJSON(row[9], []),
        Actual_Live_Date:  row[10] || '',
        Actual_End_Date:   row[11] || '',
        Special_Events:    row[12] || '',
        Raw_Impressions:   row[13] || '',
    };
    return obj;
}

/** Determine last completed step for a campaign tracking row */
function computeLastStep(parsedRows) {
    if (!parsedRows || parsedRows.length === 0) return 'Not Started';
    // Pick row with most recent action or delivered status
    const delivered = parsedRows.find(r =>
        (r['Status'] || '').toLowerCase() === 'delivered'
    );
    const best = delivered || parsedRows[parsedRows.length - 1] || {};

    const status = (best['Status'] || '').toLowerCase();
    if (status === 'delivered') return 'Analysis Delivered ✅';

    const action = (best['Last_Action'] || '').toLowerCase();
    if (action.includes('analysis') || action.includes('sent')) return 'Analysis Sent';
    if (action.includes('data')) return 'Data Received';
    if (action === 'initiation') return 'Email Received — Pending Analysis';

    return 'Initiated';
}


// ── GET /api/campaigns ───────────────────────────────────────────────────────
app.get('/api/campaigns', async (req, res) => {
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SHEET_ID,
            range: 'System_Campaign_Registry!A:I',
        });
        res.json(rowsToObjects(response.data.values));
    } catch (error) {
        console.error('[/api/campaigns]', error.message);
        res.status(500).json({ error: 'Failed to fetch campaigns', detail: error.message });
    }
});

// ── GET /api/summary ─────────────────────────────────────────────────────────
app.get('/api/summary', async (req, res) => {
    try {
        const regRes = await sheets.spreadsheets.values.get({
            spreadsheetId: SHEET_ID, range: 'System_Campaign_Registry!A:I',
        });
        const campaigns = rowsToObjects(regRes.data.values);
        const totalCampaigns = campaigns.length;
        const totalCreatives = campaigns.reduce((s, c) => s + (parseInt(c['Creative_Count'] || '0', 10) || 0), 0);
        const delivered = campaigns.filter(c => (c['Delivery_Status'] || '').toLowerCase() === 'delivered').length;
        const pending   = campaigns.filter(c => (c['Delivery_Status'] || '').toLowerCase() === 'pending').length;
        res.json({ totalCampaigns, delivered, pending, totalCreatives, activeThreads: totalCampaigns });
    } catch (error) {
        console.error('[/api/summary]', error.message);
        res.status(500).json({ error: 'Failed to fetch summary', detail: error.message });
    }
});

// ── GET /api/activity ────────────────────────────────────────────────────────
app.get('/api/activity', async (req, res) => {
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SHEET_ID, range: 'Activity_Log!A:F',
        });
        const all = rowsToObjects(response.data.values);
        res.json(all.slice(-40).reverse());
    } catch (error) {
        console.error('[/api/activity]', error.message);
        res.status(500).json({ error: 'Failed to fetch activity log', detail: error.message });
    }
});

// ── GET /api/campaign/:productName ───────────────────────────────────────────
app.get('/api/campaign/:productName', async (req, res) => {
    const { productName } = req.params;
    const decodedProduct = decodeURIComponent(productName);

    try {
        // 1. Registry row
        const regRes = await sheets.spreadsheets.values.get({
            spreadsheetId: SHEET_ID, range: 'System_Campaign_Registry!A:I',
        });
        const registryCampaigns = rowsToObjects(regRes.data.values);
        const registryRow = registryCampaigns.find(c =>
            (c['Product_Name'] || '').toLowerCase() === decodedProduct.toLowerCase()
        );
        if (!registryRow) {
            return res.status(404).json({ error: 'Campaign not found in registry' });
        }

        // 2. Metrics & Tracking
        const trackRes = await sheets.spreadsheets.values.get({
            spreadsheetId: SHEET_ID, range: 'Campaign_Tracking!A:O',
        });
        const allTrackingRows = (trackRes.data.values || []).slice(1);
        
        const matchedRaw = allTrackingRows.filter(row => {
            const col0 = (row[0] || '').toLowerCase();
            const col2 = (row[2] || '').toLowerCase();
            return isFuzzyMatch(col0, decodedProduct) || isFuzzyMatch(col2, decodedProduct);
        });

        const parsedRows = matchedRaw.map(r => parseTrackingRow(r)).filter(Boolean);

        let historyLog = [];
        let allFilesData = [];
        let trackingDetail = {};
        let surgicalMetrics = { impressions: '', spots: '' };

        parsedRows.forEach(obj => {
            const log = Array.isArray(obj['History_Log']) ? obj['History_Log'] : [];
            historyLog.push(...log);
            const files = Array.isArray(obj['All_Files_Data']) ? obj['All_Files_Data'] : [];
            allFilesData.push(...files);

            if (obj.Actual_Live_Date && (!trackingDetail.Actual_Live_Date || trackingDetail.Actual_Live_Date === 'TBD')) {
                const parsed = parseSurgicalValue(obj.Actual_Live_Date);
                obj.Actual_Live_Date = parsed.date || obj.Actual_Live_Date;
                if (parsed.value) surgicalMetrics.spots = parsed.value;
            }
            if (obj.Actual_End_Date) {
                const parsed = parseSurgicalValue(obj.Actual_End_Date);
                obj.Actual_End_Date = parsed.date || obj.Actual_End_Date;
            }
            if (!surgicalMetrics.impressions && obj.Raw_Impressions) {
                surgicalMetrics.impressions = obj.Raw_Impressions;
            }

            if (Object.keys(obj).length > (Object.keys(trackingDetail).length || 0)) {
                trackingDetail = obj;
            }
        });

        const filesSeen = new Set();
        allFilesData = allFilesData.filter(f => {
            if (!f.name || filesSeen.has(f.name)) return false;
            filesSeen.add(f.name);
            return true;
        });

        // 3. Analysis History
        try {
            const hRes = await sheets.spreadsheets.values.get({
                spreadsheetId: SHEET_ID, range: 'Analysis_History!A:G'
            });
            const hRows = rowsToObjects(hRes.data.values);
            hRows.forEach(hr => {
                const campaignName = hr['Campaign_Name'] || '';
                if (isFuzzyMatch(campaignName, decodedProduct)) {
                    const fname = hr['File_Name'];
                    if (fname && !filesSeen.has(fname)) {
                        filesSeen.add(fname);
                        const link = hr['OneDrive_Link'] || '';
                        allFilesData.push({
                            name: fname,
                            time: hr['Shared_Date'],
                            sender: hr['Sender'],
                            onedrive_link: link,
                            onedrive_id: link.startsWith('Local:') ? link : '',
                            path: link.startsWith('Local:') ? link.replace('Local:', '').trim() : ''
                        });
                    }
                }
            });
        } catch (e) {
            console.error('Analysis_History error:', e.message);
        }

        // 4. Creative sheet
        const tabName = registryRow['Original_Sheets'] || '';
        let mediaMappings = [];
        let totalDurationSec = 0;

        if (tabName) {
            try {
                const creativeRes = await sheets.spreadsheets.values.get({
                    spreadsheetId: CREATIVE_SHEET, range: `${tabName}!A:L`,
                });
                const creatives = rowsToObjects(creativeRes.data.values);
                const mediaMap = {};
                
                creatives.forEach(c => {
                    const lcObj = {};
                    Object.keys(c).forEach(k => { lcObj[k.toLowerCase()] = c[k]; });
                    const dur = parseFloat(lcObj['video duration'] || lcObj['duration'] || '0');
                    if (!isNaN(dur)) totalDurationSec += dur;
                    
                    const filename = lcObj['nomenclature'] || lcObj['file name'] || lcObj['creative'] || '';
                    if (!filename) return;
                    
                    const media = lcObj['media'] || lcObj['platform'] || 'Unknown';
                    if (!mediaMap[media]) mediaMap[media] = [];
                    mediaMap[media].push({
                        file: filename,
                        duration: dur ? String(dur) : '',
                        pitch: lcObj['pitch_shift_levels'] || '0',
                        path: lcObj['path'] || '',
                        language: lcObj['language'] || '',
                    });
                });
                mediaMappings = Object.entries(mediaMap).map(([media, files]) => ({ media, files }));
            } catch (err) {
                console.warn(`[creative tab '${tabName}']`, err.message);
            }
        }

        const response = {
            ...registryRow,
            ...trackingDetail,
            Last_Step: computeLastStep(parsedRows),
            History_Log: (historyLog || []).sort((a, b) => new Date(b.match(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/)?.[0] || 0) - new Date(a.match(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/)?.[0] || 0)),
            All_Files_Data: allFilesData,
            Media_Mappings: mediaMappings,
            Total_Duration_Sec: totalDurationSec,
            Metrics: (() => {
                if (surgicalMetrics.impressions || surgicalMetrics.spots) {
                    return [{
                        Media_Platform: trackingDetail.Media_Platforms || 'Cross Media',
                        Impressions: surgicalMetrics.impressions || '—',
                        LTV_Spots: surgicalMetrics.spots || '—',
                        Start_Date: trackingDetail.Actual_Live_Date,
                        End_Date: trackingDetail.Actual_End_Date
                    }];
                }
                return [];
            })(),
        };

        res.json(response);
    } catch (error) {
        console.error('[/api/campaign]', error.message);
        res.status(500).json({ error: 'Failed to fetch campaign details', detail: error.message });
    }
});

// ── GET /api/campaign/:productName/compare ──────────────────────────────────
app.get('/api/campaign/:productName/compare', async (req, res) => {
    try {
        const fileIdsParam = req.query.ids;
        if (!fileIdsParam) return res.status(400).json({ error: 'Missing onedrive_ids parameter' });
        
        const fileIds = fileIdsParam.split(',');
        const reports = [];
        const fs = require('fs');

        for (const fileId of fileIds) {
            if (!fileId) continue;
            try {
                let fileBuffer;
                let filenameStr;
                let modTime;

                if (fileId.startsWith('Local:')) {
                    const cleanPath = fileId.replace('Local:', '').trim();
                    const localPath = path.resolve(__dirname, '../../', cleanPath);
                    if (!fs.existsSync(localPath)) throw new Error('Local file not found: ' + localPath);
                    
                    fileBuffer = fs.readFileSync(localPath);
                    filenameStr = path.basename(localPath);
                    modTime = fs.statSync(localPath).mtime.toISOString();
                } else {
                    if (!process.env.MS_ACCESS_TOKEN) throw new Error('MS_ACCESS_TOKEN missing');
                    
                    const metaUrl = `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}`;
                    const metaRes = await axios.get(metaUrl, {
                        headers: { 'Authorization': `Bearer ${process.env.MS_ACCESS_TOKEN}` }
                    });
                    filenameStr = metaRes.data.name;
                    modTime = metaRes.data.lastModifiedDateTime;

                    const fileUrl = `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/content`;
                    const response = await axios.get(fileUrl, {
                        headers: { 'Authorization': `Bearer ${process.env.MS_ACCESS_TOKEN}` },
                        responseType: 'arraybuffer'
                    });
                    fileBuffer = response.data;
                }

                const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
                const sheets = [];

                workbook.SheetNames.forEach(sheetName => {
                    const worksheet = workbook.Sheets[sheetName];
                    const rawData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
                    if (rawData.length > 0) sheets.push({ name: sheetName, rawData });
                });

                reports.push({ onedrive_id: fileId, name: filenameStr, time: modTime, sheets });
            } catch (err) {
                console.error(`Error processing file ${fileId}:`, err.message);
                reports.push({ onedrive_id: fileId, error: err.message });
            }
        }

        reports.sort((a, b) => new Date(a.time) - new Date(b.time));
        res.json(reports);
    } catch (err) {
        console.error('Error in compare endpoint:', err.message);
        res.status(500).json({ error: 'Failed to generate comparison', detail: err.message });
    }
});

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', port: PORT }));

app.listen(PORT, () => {
    console.log(`✅  Dashboard Backend running → http://localhost:${PORT}`);
});
