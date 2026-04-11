# Project Management Automation

[![Python Version](https://img.shields.io/badge/python-3.10%2B-blue.svg)](https://www.python.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

An automated system designed to streamline the tracking and management of project-related media and data files received via Gmail. This tool orchestrates the entire campaign lifecycle, from initial data retrieval to cloud storage and stakeholder reporting.

## 🚀 Overview

The system polls Gmail for campaign-related emails, isolates them by thread to prevent data clashing, and intelligently routes attachments to OneDrive while updating a master tracking registry in Google Sheets.

## ✨ Key Features

- **Automated Fetching:** Polls Gmail every 15 minutes for project-related communications.
- **Thread Isolation:** Uses Gmail Thread IDs to ensure strict campaign data integrity.
- **Dynamic Routing:** Fuzzy-matches email subjects to identify products and routes files to specific OneDrive directories.
- **Cloud Synchronization:** Automatically uploads creatives to `Original ocreative/` and logs to `Data_logs/`.
- **Integrated Reporting:** 
  - **Daily Summaries:** Quick digest of processed items.
  - **Weekly Status:** Comprehensive campaign status sent every Sunday at 10:00 AM.
  - **Analysis Reminders:** Alerts triggered if analysis is delayed beyond 3 days.

## 🛠 Technical Architecture

- **Core Logic:** Python 3.10+
- **Integrations:**
  - **Gmail API:** Email polling and attachment extraction.
  - **Google Sheets API:** Master registry and campaign tracking.
  - **Microsoft Graph API:** Automated OneDrive folder management and file uploads.

### Project Structure

```text
├── src/
│   ├── campaign_manager.py  # Lifecycle orchestration & notifications
│   ├── onedrive_client.py   # OneDrive routing & uploads
│   └── sheets_client.py     # Multi-spreadsheet management
├── config/                  # Configuration & settings
├── main.py                  # Application entry point
└── requirements.txt         # Project dependencies
```

## ⚙️ Setup & Configuration

1. **Environment Variables:**
   - Define `GMAIL_SEARCH_QUERY` for filtering emails.
   - Configure `CREATIVE_TRACKING_SHEET_ID` and `LOGGING_SHEET_ID`.
   - Provide `MS_ACCESS_TOKEN` for OneDrive connectivity.

2. **Credentials:**
   - Ensure `credentials.json` and `token.json` are present in the root directory for Google Workspace access.

3. **Installation:**
   ```bash
   pip install -r requirements.txt
   ```

## 🛡 Mandatory Patterns

- **OneDrive Sync:** All local files are temporary; the system ensures immediate synchronization with OneDrive.
- **Strict Isolation:** Data is never merged across different threads.
- **Stakeholder Integrity:** Automated notifications must include all historical files from the thread and CC relevant stakeholders.

---
Developed by [Chaitanya Soni](mailto:chaitanya@syncmedia.io)
