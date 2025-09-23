"""
Embedding store for storing and retrieving vector embeddings of winning content.
"""

import json
import numpy as np
from typing import Dict, List, Optional, Tuple
from datetime import datetime
from app.core.logging import logger


class EmbeddingStore:
    """Simple in-memory embedding store for storing winning content examples."""
    
    def __init__(self):
        self.store: Dict[str, Dict] = {}
        logger.info("EmbeddingStore initialized")

    def add(self, key: str, text: str, metadata: Optional[Dict] = None) -> bool:
        """
        Add text content to the embedding store.
        
        Args:
            key: Unique key for the content (e.g., "brand:123:winner:456")
            text: The text content to store
            metadata: Optional metadata about the content
            
        Returns:
            bool: True if successfully added
        """
        try:
            # In a real implementation, you would generate actual embeddings here
            # For now, we'll store the text and metadata
            self.store[key] = {
                "text": text,
                "metadata": metadata or {},
                "created_at": datetime.utcnow().isoformat(),
                "embedding": self._generate_dummy_embedding(text)  # Placeholder
            }
            logger.info(f"Added content to embedding store with key: {key}")
            return True
        except Exception as e:
            logger.error(f"Error adding content to embedding store: {e}")
            return False

    def get(self, key: str) -> Optional[Dict]:
        """
        Retrieve content from the embedding store.
        
        Args:
            key: The key to retrieve
            
        Returns:
            Dict containing the content and metadata, or None if not found
        """
        return self.store.get(key)

    def search(self, query_text: str, limit: int = 10) -> List[Tuple[str, float, Dict]]:
        """
        Search for similar content using text similarity.
        
        Args:
            query_text: The text to search for
            limit: Maximum number of results to return
            
        Returns:
            List of tuples (key, similarity_score, content_dict)
        """
        try:
            query_embedding = self._generate_dummy_embedding(query_text)
            results = []
            
            for key, content in self.store.items():
                similarity = self._compute_similarity(query_embedding, content["embedding"])
                results.append((key, similarity, content))
            
            # Sort by similarity score (descending) and return top results
            results.sort(key=lambda x: x[1], reverse=True)
            return results[:limit]
        except Exception as e:
            logger.error(f"Error searching embedding store: {e}")
            return []

    def get_brand_winners(self, brand_id: str) -> List[Dict]:
        """
        Get all winning content for a specific brand.
        
        Args:
            brand_id: The brand ID to filter by
            
        Returns:
            List of winning content dictionaries
        """
        brand_key_prefix = f"brand:{brand_id}:winner:"
        winners = []
        
        for key, content in self.store.items():
            if key.startswith(brand_key_prefix):
                winners.append({
                    "key": key,
                    "content": content["text"],
                    "metadata": content["metadata"],
                    "created_at": content["created_at"]
                })
        
        return winners

    def delete(self, key: str) -> bool:
        """
        Delete content from the embedding store.
        
        Args:
            key: The key to delete
            
        Returns:
            bool: True if successfully deleted
        """
        try:
            if key in self.store:
                del self.store[key]
                logger.info(f"Deleted content from embedding store with key: {key}")
                return True
            return False
        except Exception as e:
            logger.error(f"Error deleting content from embedding store: {e}")
            return False

    def _generate_dummy_embedding(self, text: str) -> np.ndarray:
        """
        Generate a dummy embedding for the text.
        In a real implementation, this would use a proper embedding model.
        """
        # Simple hash-based embedding for demonstration
        import hashlib
        hash_obj = hashlib.md5(text.encode())
        hash_bytes = hash_obj.digest()
        
        # Convert to numpy array (128 dimensions)
        embedding = np.frombuffer(hash_bytes, dtype=np.uint8).astype(np.float32)
        
        # Pad or truncate to 128 dimensions
        if len(embedding) < 128:
            embedding = np.pad(embedding, (0, 128 - len(embedding)), mode='constant')
        else:
            embedding = embedding[:128]
        
        # Normalize
        embedding = embedding / np.linalg.norm(embedding)
        
        return embedding

    def _compute_similarity(self, embedding1: np.ndarray, embedding2: np.ndarray) -> float:
        """
        Compute cosine similarity between two embeddings.
        """
        try:
            dot_product = np.dot(embedding1, embedding2)
            norm1 = np.linalg.norm(embedding1)
            norm2 = np.linalg.norm(embedding2)
            
            if norm1 == 0 or norm2 == 0:
                return 0.0
            
            return dot_product / (norm1 * norm2)
        except Exception as e:
            logger.error(f"Error computing similarity: {e}")
            return 0.0

    def get_stats(self) -> Dict:
        """
        Get statistics about the embedding store.
        
        Returns:
            Dict containing store statistics
        """
        total_items = len(self.store)
        brand_counts = {}
        
        for key in self.store.keys():
            if key.startswith("brand:"):
                parts = key.split(":")
                if len(parts) >= 2:
                    brand_id = parts[1]
                    brand_counts[brand_id] = brand_counts.get(brand_id, 0) + 1
        
        return {
            "total_items": total_items,
            "brands_with_winners": len(brand_counts),
            "brand_counts": brand_counts
        }



