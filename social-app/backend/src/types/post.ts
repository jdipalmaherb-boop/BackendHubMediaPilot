export interface SavePostRequest {
  fileUrl: string;
  caption: string;
  platforms: string[];
  scheduledDate?: string; // ISO string
  orgId: string;
}

export interface SavePostResponse {
  success: boolean;
  draftId: string;
  message: string;
  error?: string;
}

export interface Post {
  id: string;
  orgId: string;
  content: string;
  platforms: string[];
  scheduledAt?: string;
  status: 'DRAFT' | 'PENDING' | 'SCHEDULED' | 'PUBLISHED' | 'FAILED';
  assetId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GetPostsResponse {
  success: boolean;
  posts: Post[];
  error?: string;
}



