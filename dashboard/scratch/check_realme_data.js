const { google } = require('googleapis');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

const SHEET_ID = process.env.LOGGING_SHEET_ID;

async function checkRow() {
    const auth = new google.auth.GoogleAuth({
        keyFile: path.join(__dirname, '../backend/credentials.json'),
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    try {
        const trackRes = await sheets.spreadsheets.values.get({
            spreadsheetId: SHEET_ID, range: 'Campaign_Tracking!A:L',
        });
        const rows = trackRes.data.values || [];
        // Find Realme row
        const realme = rows.find(r => (r[2] || '').toLowerCase() === 'realme');
        console.log('--- REALME ROW ---');
        console.log(JSON.stringify(realme, null, 2));

    } catch (err) {
        console.error('Error:', err.message);
    }
}

checkRow();
