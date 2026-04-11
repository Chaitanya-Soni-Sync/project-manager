# Project Management Automation - Operational Guide

## Core Objective
Automate the tracking and management of project-related media and data files received via email, focusing on the campaign lifecycle from initiation to analysis delivery.

## Workflow Summary
1.  **Fetch:** Polls Gmail every 15 minutes for emails matching `GMAIL_SEARCH_QUERY`.
2.  **Extract & Isolate:** Uses **Gmail Thread ID** for strict campaign isolation to prevent data clashing.
3.  **Identify:** Fuzzy-matches the email subject to the **`System_Campaign_Registry`** (Logging Spreadsheet) to identify the product and its tracking tab.
4.  **Cloud Storage (OneDrive):**
    *   **Root:** `/Users/chaitanyasoni/Library/CloudStorage/OneDrive-Personal/JHS X SYNC`.
    *   **Dynamic Matching:** Uses aggressive wildcard matching for existing folders (e.g., handles "Nevia" vs "Nivea", "Detol" vs "Dettol").
    *   **Subfolders:** Creatives go to `Original ocreative/`; Logs go to `Data_logs/`.
    *   **New Campaigns:** Automatically creates `JHS - [Product Name] X SYNC` if no match is found.
5.  **Alerting & Communication:**
    *   **Mandatory CC:** Both `nikhil@syncmedia.io` and `chaitanya@syncmedia.io` MUST be included in all automated notifications.
    *   **Cumulative History:** Stakeholder emails must attach **all files** received throughout the thread's history.
6.  **Reporting:** 
    *   **Daily:** Summary of all processed items sent at `REPORT_TIME`.
    *   **Weekly (Sunday 10:00 AM):** A comprehensive status summary of all active/pending campaigns sent to Nikhil.
    *   **Analysis Reminders:** Sent to Chaitanya if analysis is not delivered within 3 days of data receipt.

## Technical Architecture
- **Language:** Python 3.10+
- **APIs:** Google Workspace (Gmail, Sheets, Drive), Microsoft Graph (OneDrive).
- **Key Modules:**
  - `src/campaign_manager.py`: Orchestrates lifecycle, thread isolation, and stakeholder notifications.
  - `src/onedrive_client.py`: Manages dynamic folder routing and cloud uploads.
  - `src/sheets_client.py`: Handles multi-spreadsheet management and the master registry.

## Critical Mandates & Patterns
- **Wildcard Metadata Search:** Always search for metadata columns (Media, Platform, Pitch, Duration) using keyword matching (e.g., "Media/Platform").
- **Strict Thread Isolation:** Never merge data across different Gmail threads.
- **Impression Extraction:** Prioritize numeric extraction from columns containing 'TAM', 'Imp', 'Mn', or 'YouTube'.
- **OneDrive Sync:** All files must be moved to OneDrive immediately; local storage is strictly for temporary processing.

## Configuration
- `CREATIVE_TRACKING_SHEET_ID`: Source for creative metadata.
- `LOGGING_SHEET_ID`: Dedicated spreadsheet for `Campaign_Tracking` and `Activity_Log`.
- `MS_ACCESS_TOKEN`: Direct token for OneDrive connectivity.
