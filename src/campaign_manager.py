import datetime
import re
import json
from src.email_client import get_gmail_service, send_email, parse_email_content, download_thread_attachments
from src.sheets_client import find_row_by_id, append_sheet_row, update_sheet_row, get_sheet_data, create_sheet_if_not_exists, get_sheets_service
from src.config import NIKHIL_EMAIL, CHAITANYA_EMAIL, CAMPAIGN_TRACKING_SHEET_NAME, ACTIVITY_LOG_SHEET_NAME, CLIENT_DOMAIN, TEAM_DOMAIN, LOGGING_SHEET_ID, CREATIVE_TRACKING_SHEET_ID

# Configuration
CAMPAIGN_SHEET = CAMPAIGN_TRACKING_SHEET_NAME
ACTIVITY_LOG_SHEET = ACTIVITY_LOG_SHEET_NAME
METRICS_SHEET = "Campaign_Metrics"
ANALYSIS_HISTORY_SHEET = "Analysis_History"

# Headers
CAMPAIGN_HEADERS = [
    "Campaign_ID", "Thread_ID", "Product_Name", "Start_Date", "Media_Platforms", 
    "Creative_Count", "Last_Action", "Status", "All_Files_Data", "History_Log", "LTV_Spots", "End_Date"
]

METRICS_HEADERS = [
    "Campaign_ID", "Media_Platform", "Impressions", "LTV_Spots", "Start_Date", "End_Date", "Data_Source_File", "Timestamp"
]

ANALYSIS_HISTORY_HEADERS = [
    "Campaign_Name", "File_Name", "Shared_Date", "OneDrive_Link", "Sender"
]

def initialize_sheets():
    if create_sheet_if_not_exists(CAMPAIGN_SHEET, spreadsheet_id=LOGGING_SHEET_ID):
        # Always check/reset headers to ensure indices match our code
        service = get_sheets_service()
        service.spreadsheets().values().update(
            spreadsheetId=LOGGING_SHEET_ID, range=f"{CAMPAIGN_SHEET}!A1",
            valueInputOption='USER_ENTERED', body={'values': [CAMPAIGN_HEADERS]}
        ).execute()
    
    if create_sheet_if_not_exists(METRICS_SHEET, spreadsheet_id=LOGGING_SHEET_ID):
        append_sheet_row(f"{METRICS_SHEET}!A1", METRICS_HEADERS, spreadsheet_id=LOGGING_SHEET_ID)
        
    if create_sheet_if_not_exists(ANALYSIS_HISTORY_SHEET, spreadsheet_id=LOGGING_SHEET_ID):
        append_sheet_row(f"{ANALYSIS_HISTORY_SHEET}!A1", ANALYSIS_HISTORY_HEADERS, spreadsheet_id=LOGGING_SHEET_ID)
        
    create_sheet_if_not_exists(ACTIVITY_LOG_SHEET, spreadsheet_id=LOGGING_SHEET_ID)

initialize_sheets()

from dateutil import parser as dateparser

def check_reminders():
    """Checks for campaigns that haven't delivered analysis in 3 days."""
    rows = get_sheet_data(f"{CAMPAIGN_SHEET}!A:L", spreadsheet_id=LOGGING_SHEET_ID)
    if not rows: return

    now = datetime.datetime.now()
    for i, row in enumerate(rows):
        if i == 0: continue
        
        # CAMPAIGN_HEADERS: Status=7, End_Date=11, Product_Name=2
        if len(row) > 7 and row[7] == "Pending" and len(row) > 11 and row[11] and row[11] != "TBD":
            product_name = row[2]
            # Ignore garbage/automatic replies
            if any(x in product_name.lower() for x in ["automatic reply", "new", "unknown"]):
                continue
                
            try:
                end_dt = dateparser.parse(row[11])
                if end_dt and (now - end_dt).days >= 3:
                    print(f"Reminder Triggered for: {product_name}")
                    send_reminder_to_chaitanya(product_name)
            except Exception as e:
                print(f"Error parsing date in reminders for {product_name}: {e}")
                continue

def send_reminder_to_chaitanya(product):
    subject = f"REMINDER: Campaign Analysis Pending - {product}"
    body_html = f"<html><body><p>Hello Chaitanya,</p><p>The analysis for <b>{product}</b> is still pending since its end date.</p></body></html>"
    send_email(CHAITANYA_EMAIL, subject, body_html)

def extract_product_name(subject):
    # Remove common prefixes
    clean = re.sub(r'^(?:Re|Fwd|RE|FWD|Automatic reply):\s*', '', subject, flags=re.IGNORECASE).strip()
    
    # If the remaining subject is just "New", it's garbage
    if clean.lower() == "new":
        return "Unknown Campaign"
        
    # Match the product name before common campaign suffixes
    match = re.search(r'^([a-zA-Z0-9\s]+?)(?:\s+Campaign|\s+TV|\s+Creative|\s+&|\s+Ad\s+logs|\s+-)', clean, re.IGNORECASE)
    product = match.group(1).strip() if match else clean.strip()
    
    # Consolidation Rule: Unify Realme variations
    if 'realme' in product.lower():
        return "Realme"
    
    return product

def is_internal_only(thread_id):
    """
    Checks if a thread is internal-only (Syncmedia-to-Syncmedia).
    Returns True if NO @jiostar.com address is involved in the thread.
    """
    service = get_gmail_service()
    thread = service.users().threads().get(userId='me', id=thread_id).execute()
    messages = thread.get('messages', [])
    
    for msg in messages:
        headers = msg.get('payload', {}).get('headers', [])
        for h in headers:
            if h['name'] in ['From', 'To', 'Cc', 'Bcc']:
                if CLIENT_DOMAIN.lower() in h['value'].lower():
                    return False # Found a client email, NOT internal only
    return True # No client email found in the entire thread

def process_campaign_email(msg_id, metrics=None, onedrive_ids=None):
    email_data = parse_email_content(msg_id)
    thread_id = email_data.get('threadId')
    
    # 1. Purge internal-only threads
    if is_internal_only(thread_id):
        print(f"Purging internal-only thread: {thread_id}")
        return

    sender = email_data['sender'].lower()
    product_name = extract_product_name(email_data['subject'])
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    row_num, row_data = find_row_by_id(CAMPAIGN_SHEET, thread_id, id_column_index=1, spreadsheet_id=LOGGING_SHEET_ID)

    all_files = []; history_log = []
    if row_data:
        row_data = list(row_data)
        while len(row_data) < 10: row_data.append("")
        all_files = json.loads(row_data[8]) if row_data[8] else []
        history_log = json.loads(row_data[9]) if row_data[9] else []

    new_files_count = 0
    for f in email_data['files']:
        existing = next((af for af in all_files if af['name'] == f['name']), None)
        if not existing:
            oid = onedrive_ids.get(f['name']) if onedrive_ids else ""
            olink = f.get('onedrive_link', "N/A")
            
            file_doc = {
                'name': f['name'], 'path': f.get('path', ''), 
                'sender': email_data['sender'], 'time': timestamp,
                'onedrive_id': oid, 'onedrive_link': olink
            }
            if 'metrics' in f: file_doc['metrics'] = f['metrics']
            all_files.append(file_doc)
            new_files_count += 1
            
            # Special: Map to Analysis_History if from Team
            if TEAM_DOMAIN.lower() in email_data['sender'].lower() and f['name'].lower().endswith(('.xlsx', '.xls', '.csv')):
                append_sheet_row(ANALYSIS_HISTORY_SHEET, [product_name, f['name'], timestamp, olink, email_data['sender']], spreadsheet_id=LOGGING_SHEET_ID)

            # Log to Metrics
            if 'metrics' in f and f['metrics']['ltv_spots'] > 0:
                for entry in f['metrics']['media_breakdown']:
                    append_sheet_row(METRICS_SHEET, [product_name, entry['media'], entry['val'], f['metrics']['ltv_spots'], f['metrics']['start_date'], f['metrics']['end_date'], f['name'], timestamp], spreadsheet_id=LOGGING_SHEET_ID)
    
    current_log = f"[{timestamp}] Received email from {email_data['sender']} with {new_files_count} new files."
    history_log.append(current_log)

    if not row_data:
        # Generate a Campaign_ID (could be product name or something else)
        campaign_id = product_name
        # CAMPAIGN_HEADERS = ["Campaign_ID", "Thread_ID", "Product_Name", "Start_Date", "Media_Platforms", "Creative_Count", "Last_Action", "Status", "All_Files_Data", "History_Log", "LTV_Spots", "End_Date"]
        ltv_spots = metrics['ltv_spots'] if metrics else 0
        end_date = metrics['end_date'] if metrics else "TBD"
        
        new_row = [campaign_id, thread_id, product_name, timestamp, "Detecting...", len(all_files), "Initiation", "Pending", json.dumps(all_files), json.dumps(history_log), ltv_spots, end_date]
        append_sheet_row(CAMPAIGN_SHEET, new_row, spreadsheet_id=LOGGING_SHEET_ID)
    else:
        # Ensure row_data has enough columns
        while len(row_data) < 12: row_data.append("")
        
        row_data[5] = len(all_files); row_data[6] = current_log; row_data[8] = json.dumps(all_files); row_data[9] = json.dumps(history_log)
        
        # Update Metrics if available
        if metrics:
            if metrics.get('ltv_spots'):
                try:
                    current_ltv = int(row_data[10]) if row_data[10] else 0
                    row_data[10] = current_ltv + metrics['ltv_spots']
                except: row_data[10] = metrics['ltv_spots']
            
            if metrics.get('end_date') and metrics['end_date'] != "TBD":
                row_data[11] = metrics['end_date']
        
        # Check for key actions and notify stakeholders
        if CLIENT_DOMAIN.lower() in sender:
            if any(s in email_data['body'].lower() for s in ["campaign is ended", "campaign ended"]):
                send_data_request_to_stakeholders(product_name, thread_id)
            
            if any(f['name'].lower().endswith(('.xlsx', '.csv')) for f in email_data['files']):
                send_comprehensive_analysis_email(product_name, thread_id, all_files, history_log, metrics or {'total_impressions':"TBD",'media_breakdown':[],'ltv_spots':0,'start_date':"TBD",'end_date':"TBD"})
        
        elif TEAM_DOMAIN.lower() in sender:
            if "analysis" in email_data['body'].lower() and any(f['name'].lower().endswith(('.xlsx', '.csv')) for f in email_data['files']):
                row_data[7] = "Delivered"
                # Notify Chaitanya and Nikhil about the delivered analysis
                send_analysis_delivered_notification(product_name, thread_id)
                
        update_sheet_row(f"{CAMPAIGN_SHEET}!A{row_num}:L{row_num}", row_data, spreadsheet_id=LOGGING_SHEET_ID)

def send_comprehensive_analysis_email(product, thread_id, files, history, metrics):
    subject = f"COMPREHENSIVE DATA: Analysis Initiation for {product}"
    # Cumulative Attachments: Notification emails must include all files received throughout the entire thread's history.
    attachments = download_thread_attachments(thread_id)
    
    creative_rows = ""; media_list = set()
    for f in files:
        if f['name'].lower().endswith(('.mp4', '.mov')):
            info = get_creative_info(f['name'], product_name=product)
            creative_rows += f"<tr><td>{f['name']}</td><td>{info['pitch']}</td><td>{info['media']}</td><td>{info['duration']}</td></tr>"
            if info['media'] != "TBD" and info['media'] != "N/A": media_list.add(info['media'])
    
    summary_table = f"""<table border="1" cellpadding="5" style="border-collapse: collapse; width: 100%;"><tr style="background-color: #f2f2f2;"><th>Product</th><th>Media Platforms</th><th>Total Impressions</th><th>LTV Spots</th><th>Start Date</th><th>End Date</th></tr><tr><td>{product}</td><td>{', '.join(media_list) if media_list else 'TBD'}</td><td>{metrics['total_impressions']}</td><td>{metrics['ltv_spots']}</td><td>{metrics['start_date']}</td><td>{metrics['end_date']}</td></tr></table>"""
    body_html = f"<html><body><p>Hello,</p><p>Campaign data for <b>{product}</b> is now comprehensive. All files from the thread history are attached.</p><h4>1. Creative Metadata</h4><table border='1' cellpadding='5' style='border-collapse: collapse; width: 100%;'><tr style='background-color: #f2f2f2;'><th>File Name</th><th>Pitch Shift</th><th>Media</th><th>Duration</th></tr>{creative_rows}</table><h4>2. Metrics</h4>{summary_table}<p>Best regards,<br>Automation System</p></body></html>"
    
    # Notify both stakeholders
    recipients = f"{CHAITANYA_EMAIL}, {NIKHIL_EMAIL}"
    send_email(recipients, subject, body_html, attachments=attachments)

def send_data_request_to_stakeholders(product, thread_id):
    subject = f"ACTION REQUIRED: Data Request for {product}"
    attachments = download_thread_attachments(thread_id)
    body_html = f"<html><body><p>Campaign <b>{product}</b> has ended based on client communication. Please request the final logs.</p></body></html>"
    recipients = f"{CHAITANYA_EMAIL}, {NIKHIL_EMAIL}"
    send_email(recipients, subject, body_html, attachments=attachments)

def send_analysis_delivered_notification(product, thread_id):
    subject = f"ANALYSIS DELIVERED: {product}"
    attachments = download_thread_attachments(thread_id)
    body_html = f"<html><body><p>Team has shared the analysis for <b>{product}</b>. All thread files attached for reference.</p></body></html>"
    recipients = f"{CHAITANYA_EMAIL}, {NIKHIL_EMAIL}"
    send_email(recipients, subject, body_html, attachments=attachments)
def send_weekly_summary_to_nikhil(include_all=False):
    rows = get_sheet_data(f"System_Campaign_Registry!A:H", spreadsheet_id=LOGGING_SHEET_ID)
    if not rows or len(rows) <= 1: return
    summary_rows = ""
    for row in rows[1:]:
        if not include_all and (row[7] if len(row)>7 else "Pending") == "Delivered": continue
        summary_rows += f"<tr><td>{row[0]}</td><td>{row[7] if len(row)>7 else 'Pending'}</td><td>{row[4] if len(row)>4 else 'N/A'}</td><td>TBD</td></tr>"
    body_html = f"<html><body><p>Weekly Status:</p><table border='1' cellpadding='5' style='border-collapse: collapse; width: 100%;'><tr style='background-color: #f2f2f2;'><th>Campaign</th><th>Status</th><th>Media</th><th>End Date</th></tr>{summary_rows}</table></body></html>"
    send_email(NIKHIL_EMAIL, f"Campaign Summary - {datetime.datetime.now().strftime('%Y-%m-%d')}", body_html)
