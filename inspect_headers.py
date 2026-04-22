import os
import json
from google.oauth2 import service_account
from googleapiclient.discovery import build

def get_headers():
    # Load env manually from .env file
    env_vars = {}
    env_path = os.path.join(os.getcwd(), 'dashboard/backend/.env')
    if os.path.exists(env_path):
        with open(env_path, 'r') as f:
            for line in f:
                if '=' in line:
                    k, v = line.strip().split('=', 1)
                    env_vars[k] = v

    sheet_id = env_vars.get('LOGGING_SHEET_ID')
    creds_path = os.path.join(os.getcwd(), 'dashboard/backend/credentials.json')

    if not sheet_id or not os.path.exists(creds_path):
        print(f"Missing config. sheet_id: {sheet_id}, creds_path: {creds_path}")
        return

    creds = service_account.Credentials.from_service_account_file(creds_path)
    service = build('sheets', 'v4', credentials=creds)

    print(f"Fetching headers for {sheet_id}...")

    # Campaign_Tracking
    res = service.spreadsheets().values().get(
        spreadsheetId=sheet_id, range='Campaign_Tracking!A1:Z1').execute()
    print("Campaign_Tracking Headers:", res.get('values', [[]])[0])

    # Analysis_History
    res = service.spreadsheets().values().get(
        spreadsheetId=sheet_id, range='Analysis_History!A1:Z1').execute()
    print("Analysis_History Headers:", res.get('values', [[]])[0])

if __name__ == '__main__':
    get_headers()
