const { google } = require('googleapis');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

const SHEET_ID = process.env.LOGGING_SHEET_ID;

async function checkMetricsHeaders() {
    const auth = new google.auth.GoogleAuth({
        keyFile: path.join(__dirname, '../backend/credentials.json'),
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    try {
        const res = await sheets.spreadsheets.values.get({
            spreadsheetId: SHEET_ID, range: 'Campaign_Metrics!A1:Z1',
        });
        console.log('Campaign_Metrics Headers:', res.data.values?.[0] || []);

        const sample = await sheets.spreadsheets.values.get({
            spreadsheetId: SHEET_ID, range: 'Campaign_Metrics!A2:Z5',
        });
        console.log('Sample Metrics Data:', sample.data.values || []);

    } catch (err) {
        console.error('Error fetching metrics headers:', err.message);
    }
}

checkMetricsHeaders();
