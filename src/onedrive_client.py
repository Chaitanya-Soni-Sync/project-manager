import requests
import os
import re
from src.auth import get_ms_access_token

GRAPH_API_ENDPOINT = 'https://graph.microsoft.com/v1.0'
ROOT_PATH = "JHS X SYNC" # Your base folder in OneDrive

def get_or_create_folder(folder_name, parent_id='root'):
    """Finds a folder by name or creates it if not found."""
    access_token = get_ms_access_token()
    
    # 1. Search for folder
    search_url = f"{GRAPH_API_ENDPOINT}/me/drive/items/{parent_id}/children?$filter=name eq '{folder_name}'"
    headers = {'Authorization': f'Bearer {access_token}'}
    
    res = requests.get(search_url, headers=headers).json()
    if res.get('value'):
        return res['value'][0]['id']
    
    # 2. Create if not found
    create_url = f"{GRAPH_API_ENDPOINT}/me/drive/items/{parent_id}/children"
    data = {
        "name": folder_name,
        "folder": {},
        "@microsoft.graph.conflictBehavior": "replace"
    }
    res = requests.post(create_url, headers=headers, json=data).json()
    return res.get('id')

def find_campaign_folder(product_name):
    """
    Fuzzily finds the campaign folder in OneDrive.
    Standard: 'JHS - [Product] X SYNC'
    """
    access_token = get_ms_access_token()
    headers = {'Authorization': f'Bearer {access_token}'}
    
    # Get root folder ID for 'JHS X SYNC'
    root_res = requests.get(f"{GRAPH_API_ENDPOINT}/me/drive/root:/JHS X SYNC", headers=headers).json()
    root_id = root_res.get('id', 'root')
    
    # List all children to fuzzy match
    children_res = requests.get(f"{GRAPH_API_ENDPOINT}/me/drive/items/{root_id}/children", headers=headers).json()
    children = children_res.get('value', [])
    
    # Match logic (e.g. 'Realme' in 'Realme - SYNC X JHS')
    for child in children:
        if product_name.lower() in child['name'].lower():
            return child['id'], child['name']
            
    # Create new if no match
    new_name = f"JHS - {product_name} X SYNC"
    new_id = get_or_create_folder(new_name, parent_id=root_id)
    return new_id, new_name

def upload_file_to_onedrive(local_path, product_name, category):
    """
    Uploads a file to the correct campaign subfolder.
    Categories: 'video' -> 'Original ocreative', 'data' -> '[Product] Data'
    """
    access_token = get_ms_access_token()
    filename = os.path.basename(local_path)
    
    # 1. Get Campaign Folder
    camp_id, camp_name = find_campaign_folder(product_name)
    
    # 2. Get/Create Category Subfolder
    subfolder_name = "Original ocreative" if category == 'video' else f"Data_logs"
    subfolder_id = get_or_create_folder(subfolder_name, parent_id=camp_id)
    
    # 3. Upload
    upload_url = f"{GRAPH_API_ENDPOINT}/me/drive/items/{subfolder_id}:/{filename}:/content"
    headers = {
        'Authorization': f'Bearer {access_token}',
        'Content-Type': 'application/octet-stream'
    }
    
    with open(local_path, 'rb') as f:
        response = requests.put(upload_url, headers=headers, data=f)
    
    if response.status_code in [200, 201]:
        return response.json()
    else:
        raise Exception(f"OneDrive upload failed: {response.status_code} - {response.text}")

def get_item_details(item_id):
    """Retrieves metadata for a specific OneDrive item."""
    access_token = get_ms_access_token()
    url = f"{GRAPH_API_ENDPOINT}/me/drive/items/{item_id}"
    headers = {'Authorization': f'Bearer {access_token}'}
    res = requests.get(url, headers=headers).json()
    return res

def create_share_link(item_id):
    """Generates a shareable link for a OneDrive item."""
    access_token = get_ms_access_token()
    share_url = f"{GRAPH_API_ENDPOINT}/me/drive/items/{item_id}/createLink"
    
    headers = {
        'Authorization': f'Bearer {access_token}',
        'Content-Type': 'application/json'
    }
    
    data = {
        "type": "view",
        "scope": "anonymous"
    }
    
    response = requests.post(share_url, headers=headers, json=data)
    
    if response.status_code in [200, 201]:
        return response.json().get('link', {}).get('webUrl')
    else:
        raise Exception(f"Failed to create share link: {response.text}")

def get_category_from_extension(filename):
    """Determines if a file is a 'video' or 'data' based on extension."""
    video_exts = ['.mp4', '.mov', '.avi', '.mkv']
    data_exts = ['.xlsx', '.xls', '.csv', '.csvx']
    
    _, ext = os.path.splitext(filename.lower())
    
    if ext in video_exts:
        return 'video'
    elif ext in data_exts:
        return 'data'
    return 'other'
