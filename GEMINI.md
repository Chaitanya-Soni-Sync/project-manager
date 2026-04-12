# Project Management Automation - Operational Guide

## Core Objective
Automate the tracking, management, and reporting of cross-media campaigns (JioStar x Syncmedia). This system provides real-time visibility via a standalone dashboard and ensures systematic cloud storage and stakeholder alerting.

## Workflow Summary
1.  **Fetch & Filter:** Polls Gmail every 15 minutes for project-related emails.
    *   **Date Constraint:** Only emails from **January 1, 2026**, onwards are processed.
    *   **Domain Constraint:** Only emails from/to **`@jiostar.com`** or **`@syncmedia.io`** are analyzed.
    *   **Client Communication Rule:** Strictly **purge internal-only threads** (Syncmedia-to-Syncmedia). A thread must involve at least one `@jiostar.com` address to be tracked as a campaign.
2.  **Extract & Isolate:** Uses **Gmail Thread ID** for strict isolation.
    *   **Consolidation Rule:** Variations like "Realme 16 Pro", "Realme P4", etc., must be unified into a single master **"Realme"** campaign.
3.  **Identify:** Fuzzy-matches subjects to the **`System_Campaign_Registry`** to find the correct tracking tab and OneDrive location.
4.  **Cloud Storage (OneDrive):**
    *   **Root:** `/Users/chaitanyasoni/Library/CloudStorage/OneDrive-Personal/JHS X SYNC`.
    *   **Structure:**
        *   Creatives (`.mp4`/`.mov`) -> `[Campaign Folder]/Original ocreative/`
        *   Client Logs (`.xlsx`/`.csv`) -> `[Campaign Folder]/Data_logs/`
        *   Team Reports (from `@syncmedia.io`) -> `[Campaign Folder]/Analysis_Deliverables/`
5.  **Alerting:** 
    *   **Stakeholders:** Both `nikhil@syncmedia.io` and `chaitanya@syncmedia.io` must be notified of every key action.
    *   **Cumulative Attachments:** Notification emails must include **all files** received throughout the entire thread's history.
6.  **Reporting:** 
    *   **Daily:** General activity report at `REPORT_TIME`.
    *   **Weekly (Sunday 10:00 AM):** Status summary of active campaigns sent to Nikhil.
    *   **Reminders:** 3-day pending analysis alerts for Chaitanya.

## Technical Architecture
- **Backend (Python):** Orchestrates lifecycle, extraction, and OneDrive uploads.
- **Dashboard (Node.js/React):** Standalone product in `dashboard/` for real-time visibility.
- **Data Layers:**
  - `Campaign_Tracking`: Thread-based milestone history.
  - `Analysis_History`: Chronological log of every analysis file shared with the client.
  - `Campaign_Metrics`: Structured data (Spots, Dates, Impressions) extracted from logs.

## Critical Mandates & Patterns
- **Wildcard Metadata Search:** Always use keyword matching (`media`, `platform`, `asset`, `file name`) to adapt to varying sheet formats.
- **Impression Extraction:** Prioritize numeric extraction from columns containing 'TAM', 'Imp', 'Mn', or 'YouTube'.
- **Thread Security:** Never merge data across different Thread IDs unless explicitly instructed (e.g., Realme unification).

## 🖥 Campaign Visibility Dashboard
A standalone web portal for the interacting team to view live campaign statuses, creatives, and metrics.

### Architecture
- **Location:** `dashboard/`
- **Backend:** Node.js (Express) - Port 5001. Fetches data from Google Sheets.
- **Frontend:** React (TypeScript + Vite) - Port 5173. Interactive UI with Vanilla CSS.

### Key Metrics Tracked
- **LTV Spots:** Calculated via total row count of client BARC logs.
- **Date Range:** Extracted from min/max of the 'Date' column in data logs.
- **Media breakdown:** Granular impression extraction per media platform.

### How to Run Dashboard
1. **Backend:**
   ```bash
   cd dashboard/backend
   npm start
   ```
2. **Frontend:**
   ```bash
   cd dashboard/frontend
   npm run dev
   ```

## Configuration
- `CREATIVE_TRACKING_SHEET_ID`: Source for creative metadata.
- `LOGGING_SHEET_ID`: Dedicated spreadsheet for `Campaign_Tracking` and `Activity_Log`.
- `MS_ACCESS_TOKEN`: Direct token for OneDrive connectivity.
