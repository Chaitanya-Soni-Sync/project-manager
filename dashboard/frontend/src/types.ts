// Shared TypeScript interfaces for the Campaign Visibility Portal

export interface Campaign {
  Product_Name: string;
  Delivery_Status?: string;
  Status?: string;
  Media_Platforms?: string;
  Creative_Count?: string;
  Last_Sync?: string;
  OneDrive_Folder_Link?: string;
  OneDrive_Folder_Name?: string;
  Thread_ID?: string;
  Brand?: string;
  Category?: string;
  Pitch?: string;
  Duration?: string;
  Platform?: string;
  Original_Sheets?: string;
}

export interface FileEntry {
  name: string;
  sender?: string;
  time?: string;
  type?: string;
  path?: string;
}

export interface MetricEntry {
  Product_Name?: string;
  Media_Platform?: string;
  Impressions?: string;
  LTV_Spots?: string;
  Start_Date?: string;
  End_Date?: string;
  TAM?: string;
  YouTube?: string;
  [key: string]: string | undefined;
}

export interface CreativeFile {
  file: string;
  duration: string;
  pitch: string;
  path: string;
  status: string;
  language: string;
  driveLink: string;
}

export interface MediaMapping {
  media: string;
  files: CreativeFile[];
}

export interface CampaignDetail extends Campaign {
  // Tracking milestones
  Client_Email_Date?: string;
  Campaign_Live_Date?: string;
  Campaign_End_Date?: string;
  Nikhil_Email_Sent_Date?: string;
  Data_Received_Date?: string;
  Chaitanya_Email_Sent_Date?: string;
  Analysis_Delivered_Status?: string;
  Last_Step?: string;
  Thread_Count?: number;

  // Files & history
  History_Log: string[];
  All_Files_Data: FileEntry[];

  // Creative intelligence
  Creatives: CreativeEntry[];
  Pitch_Levels: string[];
  Media_Mappings: MediaMapping[];
  Total_Duration_Sec: number;

  // OneDrive
  OneDrive_Folder_Name?: string;

  Metrics: MetricEntry[];
}

export interface CreativeEntry {
  path?: string;
  file_name?: string;
  'video duration'?: string;
  language?: string;
  pitch_shift_levels?: string;
  Media?: string;
  product?: string;
  brand?: string;
  category?: string;
  Nomenclature?: string;
  status?: string;
  'Drive link'?: string;
  [key: string]: string | undefined;
}

export interface Summary {
  totalCampaigns: number;
  delivered: number;
  pending: number;
  totalCreatives: number;
  activeThreads: number;
}

export interface ActivityEntry {
  Timestamp?: string;
  Action?: string;
  Product?: string;
  Detail?: string;
  Status?: string;
  [key: string]: string | undefined;
}
