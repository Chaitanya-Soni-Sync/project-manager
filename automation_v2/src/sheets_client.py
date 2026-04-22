from googleapiclient.discovery import build
from src.auth import get_google_credentials
from src.config import LOGGING_SHEET_ID, CREATIVE_TRACKING_SHEET_ID
import datetime

def get_sheets_service():
    creds = get_google_credentials()
    return build('sheets', 'v4', credentials=creds)

def log_activity(timestamp, email_subject, file_name, category, onedrive_link, status="Success", spreadsheet_id=LOGGING_SHEET_ID):
    """
    Appends a row to the general activity log.
    """
    service = get_sheets_service()
    range_name = 'Activity_Log!A:F'
    values = [[timestamp, email_subject, file_name, category, onedrive_link, status]]
    body = {'values': values}
    service.spreadsheets().values().append(
        spreadsheetId=spreadsheet_id, range=range_name,
        valueInputOption='USER_ENTERED', body=body
    ).execute()

def get_sheet_data(range_name, spreadsheet_id=CREATIVE_TRACKING_SHEET_ID):
    service = get_sheets_service()
    result = service.spreadsheets().values().get(
        spreadsheetId=spreadsheet_id, range=range_name
    ).execute()
    return result.get('values', [])

def update_sheet_row(range_name, values, spreadsheet_id=LOGGING_SHEET_ID):
    service = get_sheets_service()
    body = {'values': [values]}
    service.spreadsheets().values().update(
        spreadsheetId=spreadsheet_id, range=range_name,
        valueInputOption='USER_ENTERED', body=body
    ).execute()

def append_sheet_row(range_name, values, spreadsheet_id=LOGGING_SHEET_ID):
    service = get_sheets_service()
    body = {'values': [values]}
    service.spreadsheets().values().append(
        spreadsheetId=spreadsheet_id, range=range_name,
        valueInputOption='USER_ENTERED', body=body
    ).execute()

def create_sheet_if_not_exists(sheet_name, spreadsheet_id=LOGGING_SHEET_ID):
    service = get_sheets_service()
    metadata = service.spreadsheets().get(spreadsheetId=spreadsheet_id).execute()
    sheet_names = [sheet['properties']['title'] for sheet in metadata['sheets']]
    
    if sheet_name not in sheet_names:
        print(f"Creating sheet: {sheet_name} in spreadsheet {spreadsheet_id}")
        body = {
            'requests': [{
                'addSheet': {
                    'properties': {
                        'title': sheet_name
                    }
                }
            }]
        }
        service.spreadsheets().batchUpdate(
            spreadsheetId=spreadsheet_id, body=body
        ).execute()
        return True
    return False

def find_row_by_id(sheet_name, id_value, id_column_index=0, spreadsheet_id=LOGGING_SHEET_ID):
    rows = get_sheet_data(f'{sheet_name}!A:Z', spreadsheet_id=spreadsheet_id)
    if not rows:
        return None, None
    for i, row in enumerate(rows):
        if len(row) > id_column_index and row[id_column_index] == id_value:
            return i + 1, row # Return 1-based row number
    return None, None

if __name__ == "__main__":
    # Test logging
    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    try:
        log_activity(now, "Test Subject", "test.mp4", "video", "https://onedrive.com/test", "Test Log")
        print("Log activity success!")
    except Exception as e:
        print(f"Log activity failed: {e}")
