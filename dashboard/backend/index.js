const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const axios = require('axios');
const xlsx = require('xlsx');

dotenv.config();

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
    try { return JSON.parse(str || JSON.stringify(fallback)); }
    catch { return fallback; }
}

// NEW tracking row format (11+ columns):
// [0]=Campaign_ID/Subject  [1]=Thread_ID  [2]=Product_Name  [3]=Client_Email_Date
// [4]=Media_Platforms  [5]=Creative_Count  [6]=Last_Action  [7]=Status
// [8]=All_Files_Data JSON  [9]=History_Log JSON  [10]=...
//
// OLD tracking row format (11 named columns):
// Campaign_ID | Client_Email_Date | Media_Platforms | Creatives_List | Campaign_Live_Date
// Campaign_End_Date | Nikhil_Email_Sent_Date | Data_Received_Date | Chaitanya_Email_Sent_Date
// Analysis_Delivered_Status | Reminder_Sent_Date

function parseTrackingRow(row, headers) {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i] || ''; });

    // Detect new format: Thread_ID looks like a hex string (16 chars)
    const isNewFormat = row[1] && /^[0-9a-f]{16}$/i.test(row[1]);
    if (isNewFormat) {
        // Map positions directly
        obj._Thread_ID       = row[1] || '';
        obj._Product_Name    = row[2] || '';
        obj.Client_Email_Date = row[3] || '';
        obj.Media_Platforms   = row[4] || '';
        obj._Creative_Count   = row[5] || '';
        obj._Last_Action      = row[6] || '';
        obj._Status           = row[7] || '';
        // Parse JSON blobs
        obj.All_Files_Data = safeParseJSON(row[8], []);
        obj.History_Log    = safeParseJSON(row[9], []);
    } else {
        // Old format: parse named fields
        ['All_Files_Data', 'History_Log', 'Creatives_List'].forEach(f => {
            if (typeof obj[f] === 'string') {
                obj[f] = safeParseJSON(obj[f], []);
            }
        });
    }
    return obj;
}

/** Determine last completed step for a campaign tracking row */
function computeLastStep(rows) {
    if (!rows || rows.length === 0) return 'Not Started';
    // Pick row with most data or delivered status
    const delivered = rows.find(r =>
        (r['_Status'] || r['Analysis_Delivered_Status'] || '').toLowerCase() === 'delivered'
    );
    const best = delivered || rows[rows.length - 1];

    const status = (best['_Status'] || best['Analysis_Delivered_Status'] || '').toLowerCase();
    if (status === 'delivered') return 'Analysis Delivered ✅';

    const action = (best['_Last_Action'] || '').toLowerCase();
    if (action.includes('analysis') || action.includes('sent')) return 'Analysis Sent';
    if (action.includes('data') || best['Data_Received_Date']) return 'Data Received';
    if (action === 'initiation') return 'Email Received — Pending Analysis';

    if (best['Chaitanya_Email_Sent_Date']) return 'Analysis Sent to Chaitanya';
    if (best['Data_Received_Date']) return 'Data Received';
    if (best['Nikhil_Email_Sent_Date']) return 'Nikhil Notified';
    if (best['Client_Email_Date']) return 'Email Received from Client';
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
// Returns last 40 entries from Activity_Log (falls back to Campaign_Tracking timeline)
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
// Full detail: registry info + tracking milestones + creative data + activity log
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

        // 2. Tracking rows — find ALL rows for this product (multiple threads possible)
        const trackRes = await sheets.spreadsheets.values.get({
            spreadsheetId: SHEET_ID, range: 'Campaign_Tracking!A:K',
        });
        const trackingHeaders = trackRes.data.values?.[0] || [];
        const allTrackingRows = (trackRes.data.values || []).slice(1);

        // Match by Campaign_ID (col0/subject), Product_Name (col2), or Original_Sheets name
        // Also support keyword match in email subject for fuzzy matching
        const searchTerms = [
            decodedProduct.toLowerCase(),
            (registryRow['Original_Sheets'] || '').toLowerCase(),
            (registryRow['Brand'] || '').toLowerCase().split(' ')[0], // first word of brand
        ].filter(Boolean);

        const matchedRaw = allTrackingRows.filter(row => {
            const col0 = (row[0] || '').toLowerCase();
            const col2 = (row[2] || '').toLowerCase();
            return searchTerms.some(term =>
                term.length > 2 && (
                    col0 === term || col2 === term ||
                    col0.includes(term) || col2.includes(term)
                )
            );
        });

        // Parse all matched rows
        const parsedRows = matchedRaw.map(r => parseTrackingRow(r, trackingHeaders));

        let historyLog = [];
        let allFilesData = [];
        let trackingDetail = {};

        parsedRows.forEach(obj => {
            const log = Array.isArray(obj['History_Log']) ? obj['History_Log'] : [];
            historyLog.push(...log);
            const files = Array.isArray(obj['All_Files_Data']) ? obj['All_Files_Data'] : [];
            allFilesData.push(...files);
            if (Object.keys(obj).length > Object.keys(trackingDetail).length) {
                trackingDetail = obj;
            }
        });

        // deduplicate tracker files
        const filesSeen = new Set();
        allFilesData = allFilesData.filter(f => {
            if (!f.name || filesSeen.has(f.name)) return false;
            filesSeen.add(f.name);
            return true;
        });

        // Pull missing files dynamically from Analysis_History tab!
        try {
            const hRes = await sheets.spreadsheets.values.get({
                spreadsheetId: SHEET_ID, range: 'Analysis_History!A:G'
            });
            const hRows = rowsToObjects(hRes.data.values);
            hRows.forEach(hr => {
                if ((hr['Campaign_Name'] || '').toLowerCase().includes(decodedProduct.toLowerCase()) || decodedProduct.toLowerCase().includes((hr['Campaign_Name'] || '').toLowerCase())) {
                    const fname = hr['File_Name'];
                    if (fname && !filesSeen.has(fname)) {
                        filesSeen.add(fname);
                        allFilesData.push({
                            name: fname,
                            time: hr['Shared_Date'],
                            sender: hr['Sender'],
                            onedrive_link: hr['OneDrive_Link'],
                            onedrive_id: hr['OneDrive_Link'] // pass Local link or actual link as ID bypass
                        });
                    }
                }
            });
        } catch (e) {
            console.error('Analysis_History error:', e.message);
        }

        const lastStep = computeLastStep(parsedRows);


        // 3. Creative sheet — fetch tab matching Original_Sheets name
        const tabName = registryRow['Original_Sheets'] || '';
        let creatives = [];
        let pitchLevels = [];
        let mediaMappings = [];
        let totalDurationSec = 0;

        if (tabName) {
            try {
                const creativeRes = await sheets.spreadsheets.values.get({
                    spreadsheetId: CREATIVE_SHEET,
                    range: `${tabName}!A:L`,
                });
                creatives = rowsToObjects(creativeRes.data.values);

                // Compute aggregates & normalize headers
                const normalizedCreatives = creatives.map(c => {
                    const lcObj = {};
                    Object.keys(c).forEach(k => {
                        lcObj[k.toLowerCase()] = c[k];
                    });
                    return lcObj;
                });

                normalizedCreatives.forEach(c => {
                    const dur = parseFloat(c['video duration'] || c['duration'] || '0');
                    if (!isNaN(dur)) totalDurationSec += dur;
                });

                // Unique pitch shift levels
                pitchLevels = [...new Set(
                    normalizedCreatives.map(c => c['pitch_shift_levels'] || c['pitch'] || '')
                        .filter(Boolean)
                )];

                // Media mapping: group creatives by Media → list of file names
                const mediaMap = {};
                normalizedCreatives.forEach(c => {
                    const filename = c['nomenclature'] || c['file name'] || c['file_name'] || c['creative'] || '';
                    if (!filename) return; // Skip empty rows
                    
                    const media = c['media'] || c['platform'] || 'Unknown';
                    if (!mediaMap[media]) mediaMap[media] = [];
                    mediaMap[media].push({
                        file: filename,
                        duration: c['video duration'] || c['duration'] || '',
                        pitch: c['pitch_shift_levels'] || c['pitch'] || '0',
                        path: c['path'] || '',
                        status: c['status'] || c['uploaded'] || '',
                        language: c['language'] || '',
                        driveLink: c['drive link'] || '',
                    });
                });
                mediaMappings = Object.entries(mediaMap).map(([media, files]) => ({ media, files }));

            } catch (err) {
                console.warn(`[creative tab '${tabName}']`, err.message);
            }
        }

        // 4. Compose response
        const response = {
            // Registry fields
            Product_Name: registryRow['Product_Name'] || decodedProduct,
            Brand: registryRow['Brand'] || '',
            Category: registryRow['Category'] || '',
            Media_Platforms: registryRow['Media_Platforms'] || trackingDetail['Media_Platforms'] || '',
            Creative_Count: registryRow['Creative_Count'] || '',
            Last_Sync: registryRow['Last_Sync'] || '',
            Delivery_Status: registryRow['Delivery_Status'] || '',
            OneDrive_Folder_Name: registryRow['OneDrive_Folder_Link'] || '',
            Original_Sheets: tabName,

            // Tracking milestones
            Client_Email_Date: trackingDetail['Client_Email_Date'] || '',
            Campaign_Live_Date: trackingDetail['Campaign_Live_Date'] || '',
            Campaign_End_Date: trackingDetail['Campaign_End_Date'] || '',
            Nikhil_Email_Sent_Date: trackingDetail['Nikhil_Email_Sent_Date'] || '',
            Data_Received_Date: trackingDetail['Data_Received_Date'] || '',
            Chaitanya_Email_Sent_Date: trackingDetail['Chaitanya_Email_Sent_Date'] || '',
            Analysis_Delivered_Status: trackingDetail['Analysis_Delivered_Status'] || registryRow['Delivery_Status'] || '',
            Last_Step: lastStep,

            // Files & activity
            All_Files_Data: allFilesData,
            History_Log: historyLog,
            Thread_Count: matchedRaw.length,

            // Creative intelligence
            Creatives: creatives,
            Pitch_Levels: pitchLevels,
            Media_Mappings: mediaMappings,
            Total_Duration_Sec: totalDurationSec,

            // Metrics (extracted dynamically)
            Metrics: (() => {
                const arr = [];
                allFilesData.forEach(f => {
                    if (f.metrics && Array.isArray(f.metrics.media_breakdown)) {
                        f.metrics.media_breakdown.forEach(mb => {
                            arr.push({
                                Media_Platform: mb.media,
                                Impressions: String(mb.val),
                                LTV_Spots: String(f.metrics.ltv_spots || ''),
                                Start_Date: f.metrics.start_date || '',
                                End_Date: f.metrics.end_date || '',
                            });
                        });
                    }
                });
                return arr;
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
        const fileIdsParam = req.query.ids; // Expecting a comma-separated list of onedrive_ids
        
        if (!fileIdsParam) {
            return res.status(400).json({ error: 'Missing onedrive_ids parameter' });
        }
        const fileIds = fileIdsParam.split(',');
        
        if (!process.env.MS_ACCESS_TOKEN) {
            return res.status(500).json({ error: 'MS_ACCESS_TOKEN not configured in backend' });
        }

        const reports = [];
        const fs = require('fs');

        for (const fileId of fileIds) {
            if (!fileId) continue;
            try {
                let fileBuffer;
                let filenameStr;
                let modTime;

                if (fileId.startsWith('Local:')) {
                    // Server Local Path Fallback
                    const cleanPath = fileId.replace('Local:', '').trim();
                    const localPath = path.resolve(__dirname, '../../', cleanPath);
                    if (!fs.existsSync(localPath)) throw new Error('Local file not found: ' + localPath);
                    
                    fileBuffer = fs.readFileSync(localPath);
                    filenameStr = path.basename(localPath);
                    modTime = fs.statSync(localPath).mtime.toISOString();
                } else {
                    // Regular OneDrive flow
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

                // Parse Excel buffer
                const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
                const sheets = [];

                // 4. Process each sheet
                workbook.SheetNames.forEach(sheetName => {
                    const worksheet = workbook.Sheets[sheetName];
                    const rawData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
                    
                    if (rawData.length > 0) {
                        sheets.push({ name: sheetName, rawData: rawData });
                    }
                });

                reports.push({
                    onedrive_id: fileId,
                    name: filenameStr,
                    time: modTime,
                    sheets: sheets
                });
                
            } catch (err) {
                console.error(`Error processing file ${fileId}:`, err.message);
                reports.push({ onedrive_id: fileId, error: err.message });
            }
        }

        // Return ordered chronologically by time
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
