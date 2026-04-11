import datetime
import re
import json
from src.email_client import get_gmail_service, send_email, parse_email_content
from src.sheets_client import find_row_by_id, append_sheet_row, update_sheet_row, get_sheet_data, create_sheet_if_not_exists, get_sheets_service
from src.config import NIKHIL_EMAIL, CHAITANYA_EMAIL, CAMPAIGN_TRACKING_SHEET_NAME, ACTIVITY_LOG_SHEET_NAME, CLIENT_DOMAIN, TEAM_DOMAIN, LOGGING_SHEET_ID, CREATIVE_TRACKING_SHEET_ID

# Configuration
CAMPAIGN_SHEET = CAMPAIGN_TRACKING_SHEET_NAME
ACTIVITY_LOG_SHEET = ACTIVITY_LOG_SHEET_NAME

# Headers for the Logging Spreadsheet
CAMPAIGN_HEADERS = [
    "Campaign_ID", "Thread_ID", "Product_Name", "Start_Date", "Media_Platforms", 
    "Creative_Count", "Last_Action", "Status", "All_Files_Data", "History_Log"
]

def initialize_sheets():
    if create_sheet_if_not_exists(CAMPAIGN_SHEET, spreadsheet_id=LOGGING_SHEET_ID):
        append_sheet_row(f"{CAMPAIGN_SHEET}!A1", CAMPAIGN_HEADERS, spreadsheet_id=LOGGING_SHEET_ID)
    create_sheet_if_not_exists(ACTIVITY_LOG_SHEET, spreadsheet_id=LOGGING_SHEET_ID)

initialize_sheets()

def extract_product_name(subject):
    """Surgically extracts the product name from the subject line."""
    # Remove Re:, Fwd:, and common suffixes
    clean = re.sub(r'^(?:Re|Fwd|RE|FWD):\s*', '', subject, flags=re.IGNORECASE)
    # Look for the first meaningful words before common separators
    match = re.search(r'^([a-zA-Z0-9\s]+?)(?:\s+Campaign|\s+TV|\s+Creative|\s+&|\s+Ad\s+logs|\s+-)', clean, re.IGNORECASE)
    if match:
        return match.group(1).strip()
    return clean.strip()

def get_creative_info(file_name, product_name=None):
    service = get_sheets_service()
    try:
        metadata = service.spreadsheets().get(spreadsheetId=CREATIVE_TRACKING_SHEET_ID).execute()
        sheet_names = [sheet['properties']['title'] for sheet in metadata['sheets']]
        
        # Only search in the tab that matches the product name to prevent cross-campaign clashing
        search_sheets = []
        if product_name:
            match = next((s for s in sheet_names if product_name.lower() in s.lower()), None)
            if match:
                search_sheets = [match]
        
        # If no specific tab match, we don't guess—to prevent "Google" files appearing in "Realme" reports
        if not search_sheets:
            return {'pitch': "TBD", 'media': "TBD", 'duration': "TBD"}

        for sheet in search_sheets:
            rows = get_sheet_data(f"'{sheet}'!A:Z", spreadsheet_id=CREATIVE_TRACKING_SHEET_ID)
            if not rows or len(rows) <= 1: continue

            headers = [h.strip().lower() for h in rows[0]]
            try:
                # Wildcard column matching
                file_idx = next((i for i, h in enumerate(headers) if 'file_name' in h), -1)
                pitch_idx = next((i for i, h in enumerate(headers) if 'pitch' in h), -1)
                duration_idx = next((i for i, h in enumerate(headers) if 'duration' in h), -1)

                # Multiple media columns wildcard
                media_indices = [i for i, h in enumerate(headers) if 'media' in h or 'platform' in h or 'asset' in h]

                for row in rows[1:]:
                    if len(row) > file_idx and row[file_idx].strip() == file_name.strip():
                        # Collect all found media info
                        media_values = []
                        for m_idx in media_indices:
                            if len(row) > m_idx and row[m_idx]:
                                media_values.append(row[m_idx])

                        return {
                            'pitch': row[pitch_idx] if pitch_idx != -1 and len(row) > pitch_idx else "N/A",
                            'media': ", ".join(media_values) if media_values else "N/A",
                            'duration': row[duration_idx] if duration_idx != -1 and len(row) > duration_idx else "N/A"
                        }
            except ValueError:
                continue
    except Exception as e:
        print(f"Lookup Error: {e}")
    return {'pitch': "TBD", 'media': "TBD", 'duration': "TBD"}

def process_campaign_email(msg_id, impressions="TBD"):
    """Main processing logic with strict Thread-based isolation."""
    email_data = parse_email_content(msg_id)
    thread_id = email_data.get('threadId', msg_id) # Fallback to msg_id
    subject = email_data['subject']
    product_name = extract_product_name(subject)
    sender = email_data['sender']
    body = email_data['body']
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # Find row using Thread_ID for 100% isolation
    row_num, row_data = find_row_by_id(CAMPAIGN_SHEET, thread_id, id_column_index=1, spreadsheet_id=LOGGING_SHEET_ID)

    # Initialize or Load History
    all_files = []
    history_log = []
    if row_data:
        row_data = list(row_data)
        while len(row_data) < 10: row_data.append("")
        all_files = json.loads(row_data[8]) if row_data[8] else []
        history_log = json.loads(row_data[9]) if row_data[9] else []

    # Update history with current email
    new_files_count = 0
    for f in email_data['files']:
        if f['name'] not in [af['name'] for af in all_files]:
            all_files.append({
                'name': f['name'], 'path': f.get('path', ''), 
                'sender': sender, 'time': timestamp
            })
            new_files_count += 1
    
    current_log = f"[{timestamp}] Received email from {sender} with {new_files_count} new files."
    history_log.append(current_log)

    if not row_data:
        print(f"Creating New Isolation Thread for: {product_name} (ID: {thread_id})")
        # [ID, ThreadID, Product, Start, Media, Count, LastAction, Status, Files, History]
        new_row = [product_name, thread_id, product_name, timestamp, "Detecting...", len(all_files), "Initiation", "Pending", json.dumps(all_files), json.dumps(history_log)]
        append_sheet_row(CAMPAIGN_SHEET, new_row, spreadsheet_id=LOGGING_SHEET_ID)
    else:
        # Update existing isolated thread
        row_data[5] = len(all_files)
        row_data[6] = current_log
        row_data[8] = json.dumps(all_files)
        row_data[9] = json.dumps(history_log)

        # Trigger Actions based on Isolated Signals
        if CLIENT_DOMAIN.lower() in sender.lower():
            if any(s in body.lower() for s in ["campaign is ended", "campaign ended"]):
                print(f"Isolated Signal: Campaign Ended for {product_name}")
                send_data_request_to_nikhil(product_name, all_files)
            
            if any(f['name'].lower().endswith(('.xlsx', '.csv')) for f in email_data['files']):
                print(f"Isolated Signal: Data Received for {product_name}")
                send_comprehensive_analysis_email(product_name, all_files, history_log, impressions)
        
        update_sheet_row(f"{CAMPAIGN_SHEET}!A{row_num}:J{row_num}", row_data, spreadsheet_id=LOGGING_SHEET_ID)

def send_comprehensive_analysis_email(product, files, history, impressions):
    subject = f"COMPREHENSIVE DATA: Analysis Initiation for {product}"
    attachments = [f['path'] for f in files if f.get('path')]
    
    # Table 1: Creatives (Filtered by Product Tab)
    creative_rows = ""
    media_list = set()
    for f in files:
        if f['name'].lower().endswith(('.mp4', '.mov')):
            info = get_creative_info(f['name'], product_name=product)
            creative_rows += f"<tr><td>{f['name']}</td><td>{info['pitch']}</td><td>{info['media']}</td><td>{info['duration']}</td></tr>"
            if info['media'] != "TBD": media_list.add(info['media'])
    
    # Table 2: Campaign Milestone Timeline
    history_rows = "".join([f"<li>{entry}</li>" for entry in history[-5:]]) # Show last 5 events
    
    # Table 3: Media & Impressions Summary
    summary_table = f"""
    <table border="1" cellpadding="5" style="border-collapse: collapse; width: 100%;">
        <tr style="background-color: #f2f2f2;"><th>Product</th><th>Detected Media</th><th>Impressions</th><th>Total Files Attached</th></tr>
        <tr><td>{product}</td><td>{', '.join(media_list) if media_list else 'TBD'}</td><td>{impressions}</td><td>{len(files)}</td></tr>
    </table>"""

    body_html = f"""
    <html><body style="font-family: Arial, sans-serif;">
        <p>Hello Chaitanya,</p>
        <p>The campaign data for <b>{product}</b> is now complete. Below is the full analysis context. All files from the entire thread are attached.</p>
        
        <h4>1. Creative Metadata (Isolated from {product} tab)</h4>
        <table border="1" cellpadding="5" style="border-collapse: collapse; width: 100%;">
            <tr style="background-color: #f2f2f2;"><th>File Name</th><th>Pitch Shift</th><th>Media</th><th>Duration</th></tr>
            {creative_rows if creative_rows else '<tr><td colspan="4">No video creatives detected in this thread.</td></tr>'}
        </table>

        <h4>2. Campaign Summary</h4>
        {summary_table}

        <h4>3. Recent Milestones</h4>
        <ul>{history_rows}</ul>

        <p>Best regards,<br>Automation System</p>
    </body></html>
    """
    send_email(CHAITANYA_EMAIL, subject, body_html, attachments=attachments)

def send_data_request_to_nikhil(product, files):
    subject = f"ACTION REQUIRED: Data Request for {product}"
    body_html = f"<html><body><p>Hello Nikhil,</p><p>The campaign <b>{product}</b> has ended. Please request the final tracker logs. All creative files from the thread are attached for reference.</p></body></html>"
    send_email(NIKHIL_EMAIL, subject, body_html, attachments=[f['path'] for f in files if f.get('path')])

def check_reminders():
    """Checks for campaigns that haven't delivered analysis in 3 days."""
    rows = get_sheet_data(f"{CAMPAIGN_SHEET}!A:L", spreadsheet_id=LOGGING_SHEET_ID)
    if not rows: return
    
    now = datetime.datetime.now()
    for i, row in enumerate(rows):
        if i == 0: continue
        if len(row) > 7 and row[7] == "Pending" and len(row) > 3 and row[3]:
            # This needs to be calibrated based on the final column structure
            pass

def send_weekly_summary_to_nikhil(include_all=False):
    """Sends a summary report of campaigns to Nikhil."""
    rows = get_sheet_data(f"System_Campaign_Registry!A:H", spreadsheet_id=LOGGING_SHEET_ID)
    if not rows or len(rows) <= 1: return
    
    headers = rows[0]
    summary_rows = ""
    
    for row in rows[1:]:
        prod = row[0]
        media = row[4] if len(row) > 4 else "N/A"
        status = row[7] if len(row) > 7 else "Pending"
        
        # If not include_all, only show Pending (Active) campaigns
        if not include_all and status == "Delivered":
            continue
            
        summary_rows += f"""
        <tr>
            <td>{prod}</td>
            <td>{status}</td>
            <td>{media}</td>
            <td>TBD</td>
        </tr>
        """
    
    body_html = f"""
    <html><body>
        <p>Hello Nikhil,</p>
        <p>Here is the {'weekly' if not include_all else 'current'} campaign status summary:</p>
        <table border="1" cellpadding="5" style="border-collapse: collapse; width: 100%;">
            <tr style="background-color: #f2f2f2;">
                <th>Campaign Name</th>
                <th>Status</th>
                <th>Media Platforms</th>
                <th>End Date</th>
            </tr>
            {summary_rows if summary_rows else '<tr><td colspan="4">No active campaigns to report.</td></tr>'}
        </table>
        <p>Best regards,<br>Automation System</p>
    </body></html>
    """
    send_email(NIKHIL_EMAIL, f"Campaign Status Summary - {datetime.datetime.now().strftime('%Y-%m-%d')}", body_html)
