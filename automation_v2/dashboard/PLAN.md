# Campaign Visibility Dashboard - Product Plan

## 1. Overview
The Campaign Visibility Dashboard is a standalone product designed to provide real-time, interactive insights into the cross-media campaign lifecycle. It decouples complex data stored in automation logs and Google Sheets into a high-impact, user-friendly portal for the interacting team.

## 2. Product Architecture
The product follows a modern decoupled architecture to ensure it can scale or be deployed independently of the background automation service.

- **Backend:** Node.js (Express)
  - Acts as a secure API gateway.
  - Communicates with Google Sheets API to fetch tracking, registry, and metrics data.
  - Handles data normalization and JSON parsing for the frontend.
- **Frontend:** React (TypeScript + Vite)
  - Interactive grid and detail views.
  - Styled with Vanilla CSS for maximum performance and flexibility.
  - Uses `lucide-react` for iconography and `axios` for data fetching.

## 3. Data Flow & Integration
The dashboard relies on data provided by the Python Automation Service via the Google Logging Spreadsheet (`1JA8w4s0G38mm3xworvQRtA9IUyQjSOaP38ZH_KG7ifI`):

1.  **System_Campaign_Registry:** Provides the list of all products, their original creative sheets, and their OneDrive folder names.
2.  **Campaign_Tracking:** Anchored by Gmail Thread IDs, providing the live status (Pending/Delivered) and the chronological milestone history.
3.  **Campaign_Metrics:** A granular table populated by the automation service containing:
    - **LTV Spots:** Total row counts from client BARC logs.
    - **Date Ranges:** Min/Max dates parsed from data files.
    - **Media Impressions:** Structured breakdown per platform.

## 4. Key Features
- **Global Dashboard:** A searchable grid showing all campaigns and their current delivery status.
- **Strict Isolation:** Campaign data is isolated by Thread ID, preventing clashing between similar products.
- **Automated Metrics:** Real-time extraction of spots and dates without manual entry.
- **Unified Storage Access:** Direct "one-click" links to OneDrive campaign folders.
- **Event Timeline:** A transparent log of every interaction (Email Received, Data Received, Analysis Sent).

## 5. Implementation Roadmap
- [x] Phase 1: Automation Service Update (Structured metrics extraction).
- [x] Phase 2: Backend API Development (Google Sheets integration).
- [x] Phase 3: Frontend UI Development (React/TS interactive portal).
- [x] Phase 4: Dependency Resolution (Axios/Lucide setup).
- [ ] Phase 5: Team Feedback & Metric Refinement.

## 6. Setup & Operational Guide
### Environment Variables (`dashboard/backend/.env`)
```env
PORT=5001
GOOGLE_CLIENT_SECRET_FILE=../../credentials.json
LOGGING_SHEET_ID=1JA8w4s0G38mm3xworvQRtA9IUyQjSOaP38ZH_KG7ifI
```

### Execution
1. **Start Backend:** `cd dashboard/backend && npm start`
2. **Start Frontend:** `cd dashboard/frontend && npm run dev`
3. **Access:** `http://localhost:5173`
