import os
import datetime
import traceback
import pandas as pd
from src.email_client import fetch_unread_project_emails, parse_email_content, mark_as_read
from src.drive_client import download_file_from_drive
from src.onedrive_client import upload_file_to_onedrive, create_share_link, get_category_from_extension
from src.sheets_client import log_activity
from src.campaign_manager import process_campaign_email, check_reminders
from src.config import TEAM_DOMAIN

def extract_impressions_from_file(file_path):
    """
    Attempts to extract granular metrics from Excel/CSV files.
    Returns a dict with: total_impressions, media_breakdown, ltv_spots, start_date, end_date.
    """
    metrics = {
        'total_impressions': "TBD",
        'media_breakdown': [],
        'ltv_spots': 0,
        'start_date': "TBD",
        'end_date': "TBD"
    }
    
    try:
        if file_path.endswith('.csv'):
            df = pd.read_csv(file_path)
        else:
            df = pd.read_excel(file_path)
            
        # 1. Standardize columns
        df.columns = [str(c).lower().strip() for c in df.columns]
        
        # 2. LTV Spots (Total Row Count)
        metrics['ltv_spots'] = len(df)
        
        # 3. Start/End Dates (from 'date' column)
        date_cols = [c for c in df.columns if 'date' in c]
        if date_cols:
            try:
                dates = pd.to_datetime(df[date_cols[0]], errors='coerce').dropna()
                if not dates.empty:
                    metrics['start_date'] = dates.min().strftime("%Y-%m-%d")
                    metrics['end_date'] = dates.max().strftime("%Y-%m-%d")
            except: pass

        # 4. Structured Media Impressions
        target_keywords = ['tam', 'imp', 'impression', 'mn', 'youtube', 'digital', 'spots']
        total_sum = 0
        for col in df.columns:
            if any(k in col for k in target_keywords):
                try:
                    val = pd.to_numeric(df[col], errors='coerce').sum()
                    if val > 0:
                        metrics['media_breakdown'].append({'media': col, 'val': val})
                        total_sum += val
                except: continue
        
        if total_sum > 0:
            metrics['total_impressions'] = str(total_sum)
            
    except Exception as e:
        print(f"Failed to extract metrics from {file_path}: {e}")
        
    return metrics

def process_single_email(msg_id):
    """Processes a single email: extracts, downloads, uploads, logs, and manages campaigns."""
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    try:
        # 1. Parse Email
        print(f"[{timestamp}] Processing message ID: {msg_id}")
        email_data = parse_email_content(msg_id)
        
        # 2. Pre-process files for metrics
        combined_metrics = {
            'total_impressions': "TBD", 'media_breakdown': [], 'ltv_spots': 0, 'start_date': "TBD", 'end_date': "TBD"
        }
        onedrive_id_map = {}
        
        email_items = email_data['files']
        for item in email_items:
            try:
                # 3. Handle File Download (if Drive link)
                if item['type'] == 'drive_link':
                    print(f"Downloading from Drive: {item['drive_id']}")
                    drive_file = download_file_from_drive(item['drive_id'])
                    item['path'] = drive_file['path']
                    item['name'] = drive_file['name']

                # 4. Metrics Extraction
                if item.get('path') and item['name'].lower().endswith(('.xlsx', '.csv')):
                    file_metrics = extract_impressions_from_file(item['path'])
                    item['metrics'] = file_metrics
                    # Merge logic
                    if file_metrics['total_impressions'] != "TBD": combined_metrics['total_impressions'] = file_metrics['total_impressions']
                    combined_metrics['media_breakdown'].extend(file_metrics['media_breakdown'])
                    combined_metrics['ltv_spots'] += file_metrics['ltv_spots']
                    if file_metrics['start_date'] != "TBD": combined_metrics['start_date'] = file_metrics['start_date']
                    if file_metrics['end_date'] != "TBD": combined_metrics['end_date'] = file_metrics['end_date']

                # 5. Categorize & Upload to OneDrive
                product_name = email_data.get('product_name', 'General')
                is_team_file = TEAM_DOMAIN.lower() in email_data['sender'].lower()
                is_excel = item['name'].lower().endswith(('.xlsx', '.xls', '.csv'))
                
                if is_team_file and is_excel:
                    category = 'analysis'
                else:
                    category = get_category_from_extension(item['name'])
                    
                print(f"Uploading {item['name']} (Category: {category}) to OneDrive for {product_name}...")
                onedrive_response = upload_file_to_onedrive(item['path'], product_name, category)
                item['onedrive_id'] = onedrive_response.get('id')
                onedrive_id_map[item['name']] = item['onedrive_id']
                
                # 6. Create Shareable Link
                onedrive_link = create_share_link(item['onedrive_id'])
                item['onedrive_link'] = onedrive_link
                log_activity(timestamp, email_data['subject'], item['name'], category, onedrive_link)
                
                # 7. Cleanup
                if os.path.exists(item['path']): os.remove(item['path'])
                    
            except Exception as e:
                print(f"Error processing item {item.get('name')}: {e}")

        # 8. Final Campaign Lifecycle Sync
        process_campaign_email(msg_id, metrics=combined_metrics, onedrive_ids=onedrive_id_map)
        mark_as_read(msg_id)
        
    except Exception as e:
        print(f"Failed to process email {msg_id}: {e}")
        traceback.print_exc()

def run_processor():
    """Main workflow to poll and process emails."""
    print(f"--- Starting Processing Run: {datetime.datetime.now()} ---")
    check_reminders()
    messages = fetch_unread_project_emails()
    print(f"Found {len(messages)} unread messages.")
    for msg in messages:
        process_single_email(msg['id'])
    print(f"--- Processing Run Complete: {datetime.datetime.now()} ---\n")

if __name__ == "__main__":
    run_processor()
