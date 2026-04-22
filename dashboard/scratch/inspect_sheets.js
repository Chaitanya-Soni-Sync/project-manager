const { google } = require('googleapis');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

async function inspect() {
    const auth = new google.auth.GoogleAuth({
        keyFile: path.join(__dirname, '../backend/credentials.json'),
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    const sheets = google.sheets({ version: 'v4', auth });
    const SHEET_ID = process.env.LOGGING_SHEET_ID;

    console.log('Inspecting SHEET_ID:', SHEET_ID);

    try {
        const trackRes = await sheets.spreadsheets.values.get({
            spreadsheetId: SHEET_ID, range: 'Campaign_Tracking!A1:Z1',
        });
        console.log('Campaign_Tracking Headers:', trackRes.data.values[0]);

        const historyRes = await sheets.spreadsheets.values.get({
            spreadsheetId: SHEET_ID, range: 'Analysis_History!A1:Z1',
        });
        console.log('Analysis_History Headers:', historyRes.data.values[0]);
    } catch (e) {
        console.error('Error:', e.message);
    }
}

inspect();
