import os
import datetime
import traceback
from src.email_client import fetch_unread_project_emails, parse_email_content, mark_as_read
from src.drive_client import download_file_from_drive
from src.onedrive_client import upload_file_to_onedrive, create_share_link, get_category_from_extension
from src.sheets_client import log_activity
from src.campaign_manager import process_campaign_email, check_reminders

import pandas as pd

def extract_impressions_from_file(file_path):
    """
    Attempts to extract impression counts from Excel/CSV files.
    Looks for keywords like TAM, Imp, Mn, YouTube, etc.
    """
    try:
        if file_path.endswith('.csv'):
            df = pd.read_csv(file_path)
        else:
            df = pd.read_excel(file_path)
            
        # Standardize column names
        df.columns = [str(c).lower().strip() for c in df.columns]
        
        # Look for impression columns
        target_keywords = ['tam', 'imp', 'impression', 'mn', 'youtube', 'digital', 'spots']
        found_cols = [c for c in df.columns if any(k in c for k in target_keywords)]
        
        if found_cols:
            # For simplicity, if we find values, return a summary string
            # In a real scenario, you might sum the values
            total_sum = 0
            for col in found_cols:
                try:
                    total_sum += pd.to_numeric(df[col], errors='coerce').sum()
                except:
                    continue
            return f"{total_sum} (extracted from {', '.join(found_cols)})"
    except Exception as e:
        print(f"Failed to extract impressions from {file_path}: {e}")
    return "TBD"

def process_single_email(msg_id):
    """Processes a single email: extracts, downloads, uploads, logs, and manages campaigns."""
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    try:
        # 1. Parse Email
        print(f"[{timestamp}] Processing message ID: {msg_id}")
        email_data = parse_email_content(msg_id)
        
        # 2. Pre-process files for impressions if data email
        impressions = "TBD"
        email_items = email_data['files']
        for item in email_items:
            if item['type'] == 'attachment' and item['name'].lower().endswith(('.xlsx', '.csv')):
                # We need to read it before it might be deleted or moved
                # But it's already saved to TEMP_DOWNLOAD_DIR by parse_email_content
                ext_imp = extract_impressions_from_file(item['path'])
                if ext_imp != "TBD":
                    impressions = ext_imp

        # 3. Campaign Workflow Management
        process_campaign_email(email_data, impressions=impressions)
        
        email_items = email_data['files']
        if not email_items:
            print(f"No file items found in message {msg_id}.")
            mark_as_read(msg_id)
            return
            
        for item in email_items:
            try:
                # 3. Handle File Download (if Drive link)
                if item['type'] == 'drive_link':
                    print(f"Downloading from Drive: {item['drive_id']}")
                    drive_file = download_file_from_drive(item['drive_id'])
                    item['path'] = drive_file['path']
                    item['name'] = drive_file['name']

                # 4. Categorize & Upload to OneDrive
                category = get_category_from_extension(item['name'])
                product_name = email_data.get('product_name', 'General')
                print(f"Uploading {item['name']} (Category: {category}) to OneDrive folder for {product_name}...")
                
                onedrive_response = upload_file_to_onedrive(item['path'], product_name, category)
                onedrive_id = onedrive_response.get('id')
                
                # 5. Create Shareable Link
                onedrive_link = create_share_link(onedrive_id)
                print(f"Generated OneDrive Link: {onedrive_link}")
                
                # 6. Log Activity to Sheets
                log_activity(
                    timestamp=timestamp,
                    email_subject=item['subject'],
                    file_name=item['name'],
                    category=category,
                    onedrive_link=onedrive_link,
                    status="Success"
                )
                
                # 7. Cleanup Local File
                if os.path.exists(item['path']):
                    os.remove(item['path'])
                    print(f"Cleaned up {item['name']}.")
                    
            except Exception as e:
                print(f"Error processing item {item.get('name', 'unknown')}: {e}")
                traceback.print_exc()
                log_activity(
                    timestamp=timestamp,
                    email_subject=item['subject'],
                    file_name=item.get('name', 'Unknown'),
                    category="Error",
                    onedrive_link="N/A",
                    status=f"Failed: {str(e)}"
                )

        # 8. Mark Email as Read
        mark_as_read(msg_id)
        print(f"Finished processing message {msg_id}.")
        
    except Exception as e:
        print(f"Failed to process email {msg_id}: {e}")
        traceback.print_exc()

def run_processor():
    """Main workflow to poll and process emails."""
    print(f"--- Starting Processing Run: {datetime.datetime.now()} ---")
    
    # Check for analysis reminders first
    check_reminders()

    messages = fetch_unread_project_emails()
    print(f"Found {len(messages)} unread messages.")
    
    for msg in messages:
        process_single_email(msg['id'])
    
    print(f"--- Processing Run Complete: {datetime.datetime.now()} ---\n")

if __name__ == "__main__":
    run_processor()
