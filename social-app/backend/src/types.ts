export interface BoostPostRequest {
  postId: string;
  budget: number;
  duration: number; // days
}

export interface BoostPostResponse {
  success: boolean;
  campaignId?: string;
  status?: string;
  error?: string;
  logs: BoostLog[];
}

export interface BoostLog {
  timestamp: string;
  action: string;
  status: 'success' | 'error';
  message: string;
  data?: any;
}

export interface PostData {
  id: string;
  content: string;
  finalCaption?: string;
  editedAssetUrl?: string;
  aiScore?: number;
  aiTips?: any;
  orgId: string;
  platforms: string[];
}



