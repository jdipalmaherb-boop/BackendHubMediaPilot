import { PostData } from '../types.js';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:4000';

export async function fetchPost(postId: string): Promise<PostData> {
  const response = await fetch(`${API_BASE}/posts/${postId}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch post: ${response.status}`);
  }
  return response.json();
}



