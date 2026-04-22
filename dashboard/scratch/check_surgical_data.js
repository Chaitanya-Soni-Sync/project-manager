const { google } = require('googleapis');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

const SHEET_ID = process.env.LOGGING_SHEET_ID;

async function checkHeaders() {
    const auth = new google.auth.GoogleAuth({
        keyFile: path.join(__dirname, '../backend/credentials.json'),
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    console.log('--- Inspecting headers for SHEET_ID:', SHEET_ID, '---');
    
    try {
        const trackRes = await sheets.spreadsheets.values.get({
            spreadsheetId: SHEET_ID, range: 'Campaign_Tracking!A1:Z1',
        });
        console.log('Campaign_Tracking Headers:', trackRes.data.values[0]);

        const historyRes = await sheets.spreadsheets.values.get({
            spreadsheetId: SHEET_ID, range: 'Analysis_History!A1:Z1',
        });
        console.log('Analysis_History Headers:', historyRes.data.values[0]);

        // Check a random row for data structure
        const dataRes = await sheets.spreadsheets.values.get({
            spreadsheetId: SHEET_ID, range: 'Campaign_Tracking!A2:Z2',
        });
        console.log('Sample Data Row:', dataRes.data.values[0]);

    } catch (err) {
        console.error('Error fetching headers:', err.message);
    }
}

checkHeaders();
