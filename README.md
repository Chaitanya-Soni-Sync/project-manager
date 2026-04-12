# Project Management Automation System

This system automates the tracking, storage, and reporting of cross-media campaign creatives and data logs received via Gmail. It integrates with Google Sheets for tracking and OneDrive for cloud storage.

## 🚀 Quick Start

### 1. Prerequisites
- **Python 3.10+**
- A Google Cloud Project with Gmail and Sheets API enabled.
- A Microsoft Azure App Registration for OneDrive access.

### 2. Installation
Clone the repository and install the required dependencies:
```bash
pip install -r requirements.txt
```

### 3. Configuration (`.env`)
Create a `.env` file in the root directory (use `.env.example` as a template). Fill in the following:

#### Google API
- `GOOGLE_CLIENT_SECRET_FILE`: Path to your `credentials.json`.
- `CREATIVE_TRACKING_SHEET_ID`: ID of the source tracking spreadsheet.
- `LOGGING_SHEET_ID`: ID of the spreadsheet where logs will be stored.

#### Microsoft OneDrive
- `MS_ACCESS_TOKEN`: A valid access token for Microsoft Graph API.
- `ROOT_PATH`: Should be set to `JHS X SYNC`.

#### Campaign Settings
- `NIKHIL_EMAIL`: `nikhil@syncmedia.io`
- `CHAITANYA_EMAIL`: `chaitanya@syncmedia.io`
- `CLIENT_DOMAIN`: `@jiostar.com`
- `TEAM_DOMAIN`: `@syncmedia.io`

### 4. Running the System
Start the background automation service:
```bash
python3 main.py
```

## 🛠 Features

- **Automated Gmail Polling:** Checks every 15 minutes for new campaign emails.
- **Strict Isolation:** Uses Gmail Thread IDs to keep campaigns (e.g., Realme vs. Google) completely separate.
- **Dynamic OneDrive Storage:** Automatically routes files to `JHS X SYNC/[Campaign Name]/` subfolders.
- **Smart Metadata Lookup:** Uses wildcard searching to find Media, Platform, and Pitch info from the creative sheets.
- **Stakeholder Alerts:** Automatically sends HTML emails to Nikhil and Chaitanya with all thread history files attached.
- **Scheduled Reporting:**
  - **Daily:** Summary of all actions.
  - **Sunday (10:00 AM):** Weekly status summary sent to Nikhil.
  - **Reminders:** 3-day pending analysis alerts for Chaitanya.

## 📂 Project Structure
- `src/campaign_manager.py`: Core campaign lifecycle and notification logic.
- `src/onedrive_client.py`: Dynamic cloud storage management.
- `src/sheets_client.py`: Google Sheets integration and Registry management.
- `src/processor.py`: Main processing loop and impression extraction.
- `main.py`: Entry point and scheduler.
- `dashboard/`: Campaign Visibility Dashboard (React Frontend + Node.js API).

## 📊 Campaign Visibility Dashboard
A full-stack web portal for stakeholders to get a live, visually rich overview of all tracked campaigns, creatives, and metrics. 

### Features
- **Live Sync**: Pulls real-time states and action logs directly from the active Google Sheets. 
- **Deep-Dive Views**: Click on any campaign to see milestone trackers, media breakdowns, and extracted pitch variants.
- **Dynamic KPIs**: Aggregates total delivered/pending metrics and total creative durations.
- **Dark Mode Aesthetics**: Built with premium CSS layout and glassmorphism.

### How to Run the Dashboard
The dashboard uses an Express API to connect to Google Sheets using the same OAuth credentials as the automation script.

1. **Start the Backend API (Port 5001)**
   ```bash
   cd dashboard/backend
   npm install
   npm start
   ```

2. **Start the Frontend UI (Port 5173)**
   ```bash
   cd dashboard/frontend
   npm install
   npm run dev
   ```

Access the dashboard at **http://localhost:5173**.

## 📝 Logging
All system actions are logged in the `Activity_Log` tab of your **Logging Spreadsheet**. The current status of every campaign is maintained in the `System_Campaign_Registry` tab.
