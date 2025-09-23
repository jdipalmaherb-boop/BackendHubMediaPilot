"""
Feedback loop service for learning from winning content and optimizing future posts.
"""

from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import desc, func

from app.core.logging import logger
from app.models.social_media import Post, PostMetric
from app.modules.feedback_loop.embedding_store import EmbeddingStore


class FeedbackService:
    """Service for managing the feedback loop and learning from winning content."""

    def __init__(self, embedding_store: Optional[EmbeddingStore] = None):
        self.embedding_store = embedding_store if embedding_store else EmbeddingStore()
        logger.info("FeedbackService initialized")

    def compute_ctr(self, impressions: int, clicks: int) -> float:
        """
        Compute click-through rate.
        
        Args:
            impressions: Number of impressions
            clicks: Number of clicks
            
        Returns:
            CTR as a float between 0 and 1
        """
        if impressions and impressions > 0:
            return clicks / impressions
        return 0.0

    def ingest_metrics(
        self,
        db: Session,
        post_id: str,
        platform: str,
        impressions: int,
        clicks: int,
        conversions: int,
        revenue: Decimal
    ) -> bool:
        """
        Ingest new metrics for a post.
        
        Args:
            db: Database session
            post_id: ID of the post
            platform: Social media platform
            impressions: Number of impressions
            clicks: Number of clicks
            conversions: Number of conversions
            revenue: Revenue generated
            
        Returns:
            bool: True if successfully ingested
        """
        try:
            ctr = self.compute_ctr(impressions, clicks)
            
            metric = PostMetric(
                post_id=post_id,
                platform=platform,
                impressions=impressions,
                clicks=clicks,
                ctr=ctr,
                conversions=conversions,
                revenue=revenue,
                collected_at=datetime.utcnow()
            )
            
            db.add(metric)
            db.commit()
            
            logger.info(f"Ingested metrics for post {post_id} on {platform}")
            return True
        except Exception as e:
            logger.error(f"Error ingesting metrics for post {post_id}: {e}", exc_info=True)
            db.rollback()
            return False

    def nightly_winner_job(self, db: Session) -> Dict[str, int]:
        """
        Run the nightly job to identify winning content and store it in the embedding store.
        
        Args:
            db: Database session
            
        Returns:
            Dict with statistics about the job
        """
        logger.info("Starting nightly winner job")
        
        stats = {
            "brands_processed": 0,
            "winners_identified": 0,
            "errors": 0
        }
        
        try:
            # Get all unique brand IDs
            brands = db.query(Post.brand_id).distinct().all()
            
            for (brand_id,) in brands:
                try:
                    stats["brands_processed"] += 1
                    
                    # Get all posts for this brand
                    posts = db.query(Post).filter_by(brand_id=brand_id).all()
                    
                    if not posts:
                        continue
                    
                    # Find the best performing post
                    best_post = self._find_best_post(db, posts)
                    
                    if best_post:
                        # Store the winning content in the embedding store
                        key = f"brand:{brand_id}:winner:{best_post.id}"
                        success = self.embedding_store.add(
                            key=key,
                            text=best_post.content,
                            metadata={
                                "brand_id": str(brand_id),
                                "post_id": str(best_post.id),
                                "variant": best_post.variant,
                                "created_at": best_post.created_at.isoformat()
                            }
                        )
                        
                        if success:
                            stats["winners_identified"] += 1
                            logger.info(f"Stored winning content for brand {brand_id}: {best_post.id}")
                        else:
                            stats["errors"] += 1
                            
                except Exception as e:
                    logger.error(f"Error processing brand {brand_id}: {e}", exc_info=True)
                    stats["errors"] += 1
            
            logger.info(f"Nightly winner job completed. Stats: {stats}")
            return stats
            
        except Exception as e:
            logger.error(f"Error in nightly winner job: {e}", exc_info=True)
            stats["errors"] += 1
            return stats

    def _find_best_post(self, db: Session, posts: List[Post]) -> Optional[Post]:
        """
        Find the best performing post from a list of posts.
        
        Args:
            db: Database session
            posts: List of posts to evaluate
            
        Returns:
            The best performing post, or None if no metrics found
        """
        best_post = None
        best_score = -1
        
        for post in posts:
            try:
                # Get the most recent metrics for this post
                metrics = db.query(PostMetric).filter_by(post_id=post.id).order_by(
                    desc(PostMetric.collected_at)
                ).first()
                
                if not metrics:
                    continue
                
                # Calculate composite score
                # Weight: conversions (10x), CTR (100x), revenue (1x)
                score = (
                    (metrics.conversions * 10) +
                    (metrics.ctr * 100) +
                    float(metrics.revenue or 0)
                )
                
                if score > best_score:
                    best_post = post
                    best_score = score
                    
            except Exception as e:
                logger.error(f"Error evaluating post {post.id}: {e}")
                continue
        
        return best_post

    def get_winning_content_for_brand(self, brand_id: str) -> List[Dict]:
        """
        Get all winning content for a specific brand.
        
        Args:
            brand_id: The brand ID
            
        Returns:
            List of winning content dictionaries
        """
        return self.embedding_store.get_brand_winners(brand_id)

    def search_similar_content(self, query_text: str, limit: int = 10) -> List[Dict]:
        """
        Search for content similar to the query text.
        
        Args:
            query_text: Text to search for
            limit: Maximum number of results
            
        Returns:
            List of similar content with similarity scores
        """
        results = self.embedding_store.search(query_text, limit)
        
        return [
            {
                "key": key,
                "similarity_score": score,
                "content": content["text"],
                "metadata": content["metadata"]
            }
            for key, score, content in results
        ]

    def get_feedback_stats(self) -> Dict:
        """
        Get statistics about the feedback system.
        
        Returns:
            Dict containing feedback system statistics
        """
        return self.embedding_store.get_stats()

    def analyze_performance_trends(
        self,
        db: Session,
        brand_id: str,
        days: int = 30
    ) -> Dict:
        """
        Analyze performance trends for a brand.
        
        Args:
            db: Database session
            brand_id: Brand ID to analyze
            days: Number of days to look back
            
        Returns:
            Dict containing performance analysis
        """
        try:
            start_date = datetime.utcnow() - timedelta(days=days)
            
            # Get posts and their metrics
            posts = db.query(Post).filter(
                Post.brand_id == brand_id,
                Post.created_at >= start_date
            ).all()
            
            if not posts:
                return {"error": "No posts found for the specified period"}
            
            post_ids = [post.id for post in posts]
            metrics = db.query(PostMetric).filter(
                PostMetric.post_id.in_(post_ids),
                PostMetric.collected_at >= start_date
            ).all()
            
            # Analyze by variant
            variant_performance = {}
            for post in posts:
                variant = post.variant
                if variant not in variant_performance:
                    variant_performance[variant] = {
                        "posts": 0,
                        "total_impressions": 0,
                        "total_clicks": 0,
                        "total_conversions": 0,
                        "total_revenue": 0.0
                    }
                
                variant_performance[variant]["posts"] += 1
                
                # Get metrics for this post
                post_metrics = [m for m in metrics if m.post_id == post.id]
                for metric in post_metrics:
                    variant_performance[variant]["total_impressions"] += metric.impressions
                    variant_performance[variant]["total_clicks"] += metric.clicks
                    variant_performance[variant]["total_conversions"] += metric.conversions
                    variant_performance[variant]["total_revenue"] += float(metric.revenue)
            
            # Calculate averages
            for variant, data in variant_performance.items():
                if data["posts"] > 0:
                    data["avg_ctr"] = data["total_clicks"] / data["total_impressions"] if data["total_impressions"] > 0 else 0
                    data["avg_conversion_rate"] = data["total_conversions"] / data["total_clicks"] if data["total_clicks"] > 0 else 0
                    data["avg_revenue_per_post"] = data["total_revenue"] / data["posts"]
            
            return {
                "brand_id": brand_id,
                "analysis_period_days": days,
                "total_posts": len(posts),
                "variant_performance": variant_performance,
                "best_performing_variant": max(
                    variant_performance.keys(),
                    key=lambda v: variant_performance[v]["total_revenue"]
                ) if variant_performance else None
            }
            
        except Exception as e:
            logger.error(f"Error analyzing performance trends for brand {brand_id}: {e}", exc_info=True)
            return {"error": str(e)}



