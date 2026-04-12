import datetime
import re
import json
from src.email_client import get_gmail_service, send_email, parse_email_content
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
    "Creative_Count", "Last_Action", "Status", "All_Files_Data", "History_Log"
]

METRICS_HEADERS = [
    "Campaign_ID", "Media_Platform", "Impressions", "LTV_Spots", "Start_Date", "End_Date", "Data_Source_File", "Timestamp"
]

ANALYSIS_HISTORY_HEADERS = [
    "Campaign_Name", "File_Name", "Shared_Date", "OneDrive_Link", "Sender"
]

def initialize_sheets():
    if create_sheet_if_not_exists(CAMPAIGN_SHEET, spreadsheet_id=LOGGING_SHEET_ID):
        append_sheet_row(f"{CAMPAIGN_SHEET}!A1", CAMPAIGN_HEADERS, spreadsheet_id=LOGGING_SHEET_ID)
    
    if create_sheet_if_not_exists(METRICS_SHEET, spreadsheet_id=LOGGING_SHEET_ID):
        append_sheet_row(f"{METRICS_SHEET}!A1", METRICS_HEADERS, spreadsheet_id=LOGGING_SHEET_ID)
        
    if create_sheet_if_not_exists(ANALYSIS_HISTORY_SHEET, spreadsheet_id=LOGGING_SHEET_ID):
        append_sheet_row(f"{ANALYSIS_HISTORY_SHEET}!A1", ANALYSIS_HISTORY_HEADERS, spreadsheet_id=LOGGING_SHEET_ID)
        
    create_sheet_if_not_exists(ACTIVITY_LOG_SHEET, spreadsheet_id=LOGGING_SHEET_ID)

initialize_sheets()

def extract_product_name(subject):
    clean = re.sub(r'^(?:Re|Fwd|RE|FWD):\s*', '', subject, flags=re.IGNORECASE)
    match = re.search(r'^([a-zA-Z0-9\s]+?)(?:\s+Campaign|\s+TV|\s+Creative|\s+&|\s+Ad\s+logs|\s+-)', clean, re.IGNORECASE)
    if match: return match.group(1).strip()
    return clean.strip()

def get_creative_info(file_name, product_name=None):
    service = get_sheets_service()
    try:
        metadata = service.spreadsheets().get(spreadsheetId=CREATIVE_TRACKING_SHEET_ID).execute()
        sheet_names = [sheet['properties']['title'] for sheet in metadata['sheets']]
        search_sheets = []
        if product_name:
            match = next((s for s in sheet_names if product_name.lower() in s.lower()), None)
            if match: search_sheets = [match]
        if not search_sheets: return {'pitch': "TBD", 'media': "TBD", 'duration': "TBD"}

        for sheet in search_sheets:
            rows = get_sheet_data(f"'{sheet}'!A:Z", spreadsheet_id=CREATIVE_TRACKING_SHEET_ID)
            if not rows or len(rows) <= 1: continue
            headers = [h.strip().lower() for h in rows[0]]
            try:
                # Super-flexible wildcard column matching
                file_idx = next((i for i, h in enumerate(headers) if 'file' in h and 'name' in h), -1)
                pitch_idx = next((i for i, h in enumerate(headers) if 'pitch' in h), -1)
                duration_idx = next((i for i, h in enumerate(headers) if 'duration' in h), -1)

                # Media platform can be in Media, Platform, or Asset columns
                media_indices = [i for i, h in enumerate(headers) if 'media' in h or 'platform' in h or 'asset' in h]
                for row in rows[1:]:
                    if len(row) > file_idx and row[file_idx].strip() == file_name.strip():
                        media_values = [row[m_idx] for m_idx in media_indices if len(row) > m_idx and row[m_idx]]
                        return {
                            'pitch': row[pitch_idx] if pitch_idx != -1 and len(row) > pitch_idx else "N/A",
                            'media': ", ".join(media_values) if media_values else "N/A",
                            'duration': row[duration_idx] if duration_idx != -1 and len(row) > duration_idx else "N/A"
                        }
            except: continue
    except: pass
    return {'pitch': "TBD", 'media': "TBD", 'duration': "TBD"}

def process_campaign_email(msg_id, metrics=None, onedrive_ids=None):
    email_data = parse_email_content(msg_id)
    sender = email_data['sender'].lower()
    if not (CLIENT_DOMAIN.lower() in sender or TEAM_DOMAIN.lower() in sender): return

    thread_id = email_data.get('threadId', msg_id)
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
        new_row = [product_name, thread_id, product_name, timestamp, "Detecting...", len(all_files), "Initiation", "Pending", json.dumps(all_files), json.dumps(history_log)]
        append_sheet_row(CAMPAIGN_SHEET, new_row, spreadsheet_id=LOGGING_SHEET_ID)
    else:
        row_data[5] = len(all_files); row_data[6] = current_log; row_data[8] = json.dumps(all_files); row_data[9] = json.dumps(history_log)
        if CLIENT_DOMAIN.lower() in sender:
            if any(s in email_data['body'].lower() for s in ["campaign is ended", "campaign ended"]):
                send_data_request_to_nikhil(product_name, all_files)
            if any(f['name'].lower().endswith(('.xlsx', '.csv')) for f in email_data['files']):
                send_comprehensive_analysis_email(product_name, all_files, history_log, metrics or {'total_impressions':"TBD",'media_breakdown':[],'ltv_spots':0,'start_date':"TBD",'end_date':"TBD"})
        elif TEAM_DOMAIN.lower() in sender:
            if "analysis" in email_data['body'].lower() and any(f['name'].lower().endswith(('.xlsx', '.csv')) for f in email_data['files']):
                row_data[7] = "Delivered"
        update_sheet_row(f"{CAMPAIGN_SHEET}!A{row_num}:J{row_num}", row_data, spreadsheet_id=LOGGING_SHEET_ID)

def send_comprehensive_analysis_email(product, files, history, metrics):
    subject = f"COMPREHENSIVE DATA: Analysis Initiation for {product}"
    attachments = [f['path'] for f in files if f.get('path')]
    creative_rows = ""; media_list = set()
    for f in files:
        if f['name'].lower().endswith(('.mp4', '.mov')):
            info = get_creative_info(f['name'], product_name=product)
            creative_rows += f"<tr><td>{f['name']}</td><td>{info['pitch']}</td><td>{info['media']}</td><td>{info['duration']}</td></tr>"
            if info['media'] != "TBD" and info['media'] != "N/A": media_list.add(info['media'])
    
    summary_table = f"""<table border="1" cellpadding="5" style="border-collapse: collapse; width: 100%;"><tr style="background-color: #f2f2f2;"><th>Product</th><th>Media Platforms</th><th>Total Impressions</th><th>LTV Spots</th><th>Start Date</th><th>End Date</th></tr><tr><td>{product}</td><td>{', '.join(media_list) if media_list else 'TBD'}</td><td>{metrics['total_impressions']}</td><td>{metrics['ltv_spots']}</td><td>{metrics['start_date']}</td><td>{metrics['end_date']}</td></tr></table>"""
    body_html = f"<html><body><p>Hello Chaitanya,</p><p>Campaign data for <b>{product}</b> complete. History attached.</p><h4>1. Creative Metadata</h4><table border='1' cellpadding='5' style='border-collapse: collapse; width: 100%;'><tr style='background-color: #f2f2f2;'><th>File Name</th><th>Pitch Shift</th><th>Media</th><th>Duration</th></tr>{creative_rows}</table><h4>2. Metrics</h4>{summary_table}<p>Best regards,<br>Automation System</p></body></html>"
    send_email(CHAITANYA_EMAIL, subject, body_html, attachments=attachments)

def send_data_request_to_nikhil(product, files):
    send_email(NIKHIL_EMAIL, f"ACTION REQUIRED: Data Request for {product}", f"<html><body><p>Campaign <b>{product}</b> ended. Please request logs.</p></body></html>", attachments=[f['path'] for f in files if f.get('path')])

def send_weekly_summary_to_nikhil(include_all=False):
    rows = get_sheet_data(f"System_Campaign_Registry!A:H", spreadsheet_id=LOGGING_SHEET_ID)
    if not rows or len(rows) <= 1: return
    summary_rows = ""
    for row in rows[1:]:
        if not include_all and (row[7] if len(row)>7 else "Pending") == "Delivered": continue
        summary_rows += f"<tr><td>{row[0]}</td><td>{row[7] if len(row)>7 else 'Pending'}</td><td>{row[4] if len(row)>4 else 'N/A'}</td><td>TBD</td></tr>"
    body_html = f"<html><body><p>Weekly Status:</p><table border='1' cellpadding='5' style='border-collapse: collapse; width: 100%;'><tr style='background-color: #f2f2f2;'><th>Campaign</th><th>Status</th><th>Media</th><th>End Date</th></tr>{summary_rows}</table></body></html>"
    send_email(NIKHIL_EMAIL, f"Campaign Summary - {datetime.datetime.now().strftime('%Y-%m-%d')}", body_html)
