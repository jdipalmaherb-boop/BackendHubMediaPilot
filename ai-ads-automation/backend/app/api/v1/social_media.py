"""
API endpoints for social media posts and metrics.
"""

from typing import List, Optional
from uuid import UUID
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from app.core.database import get_db
from app.core.logging import logger
from app.models.social_media import Post, PostMetric
from app.schemas.social_media import (
    PostCreate, PostUpdate, PostResponse, PostWithMetrics,
    PostMetricCreate, PostMetricUpdate, PostMetricResponse,
    PostAnalytics, BrandAnalytics
)

router = APIRouter()


# Post endpoints
@router.post("/posts", response_model=PostResponse, status_code=status.HTTP_201_CREATED)
async def create_post(
    post_data: PostCreate,
    db: Session = Depends(get_db)
):
    """Create a new social media post."""
    logger.info(f"Creating new post for brand {post_data.brand_id}")
    
    try:
        db_post = Post(**post_data.dict())
        db.add(db_post)
        db.commit()
        db.refresh(db_post)
        
        logger.info(f"Created post {db_post.id} for brand {post_data.brand_id}")
        return db_post
    except Exception as e:
        logger.error(f"Error creating post: {e}", exc_info=True)
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create post: {e}"
        )


@router.get("/posts/{post_id}", response_model=PostWithMetrics)
async def get_post(
    post_id: UUID,
    db: Session = Depends(get_db)
):
    """Get a specific post with its metrics."""
    logger.info(f"Retrieving post {post_id}")
    
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found"
        )
    
    return post


@router.get("/posts", response_model=List[PostResponse])
async def get_posts(
    brand_id: Optional[UUID] = Query(None, description="Filter by brand ID"),
    variant: Optional[str] = Query(None, description="Filter by variant"),
    limit: int = Query(100, ge=1, le=1000, description="Number of posts to return"),
    offset: int = Query(0, ge=0, description="Number of posts to skip"),
    db: Session = Depends(get_db)
):
    """Get posts with optional filtering."""
    logger.info(f"Retrieving posts with filters: brand_id={brand_id}, variant={variant}")
    
    query = db.query(Post)
    
    if brand_id:
        query = query.filter(Post.brand_id == brand_id)
    if variant:
        query = query.filter(Post.variant == variant)
    
    posts = query.order_by(desc(Post.created_at)).offset(offset).limit(limit).all()
    return posts


@router.put("/posts/{post_id}", response_model=PostResponse)
async def update_post(
    post_id: UUID,
    post_data: PostUpdate,
    db: Session = Depends(get_db)
):
    """Update a post."""
    logger.info(f"Updating post {post_id}")
    
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found"
        )
    
    try:
        update_data = post_data.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(post, field, value)
        
        db.commit()
        db.refresh(post)
        
        logger.info(f"Updated post {post_id}")
        return post
    except Exception as e:
        logger.error(f"Error updating post {post_id}: {e}", exc_info=True)
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update post: {e}"
        )


@router.delete("/posts/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_post(
    post_id: UUID,
    db: Session = Depends(get_db)
):
    """Delete a post and its metrics."""
    logger.info(f"Deleting post {post_id}")
    
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found"
        )
    
    try:
        db.delete(post)
        db.commit()
        logger.info(f"Deleted post {post_id}")
    except Exception as e:
        logger.error(f"Error deleting post {post_id}: {e}", exc_info=True)
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete post: {e}"
        )


# Post metrics endpoints
@router.post("/posts/{post_id}/metrics", response_model=PostMetricResponse, status_code=status.HTTP_201_CREATED)
async def create_post_metric(
    post_id: UUID,
    metric_data: PostMetricCreate,
    db: Session = Depends(get_db)
):
    """Create metrics for a post."""
    logger.info(f"Creating metrics for post {post_id}")
    
    # Verify post exists
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found"
        )
    
    try:
        metric_data.post_id = post_id
        db_metric = PostMetric(**metric_data.dict())
        db.add(db_metric)
        db.commit()
        db.refresh(db_metric)
        
        logger.info(f"Created metric {db_metric.id} for post {post_id}")
        return db_metric
    except Exception as e:
        logger.error(f"Error creating metric for post {post_id}: {e}", exc_info=True)
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create metric: {e}"
        )


@router.get("/posts/{post_id}/metrics", response_model=List[PostMetricResponse])
async def get_post_metrics(
    post_id: UUID,
    platform: Optional[str] = Query(None, description="Filter by platform"),
    days: int = Query(30, ge=1, le=365, description="Number of days to look back"),
    db: Session = Depends(get_db)
):
    """Get metrics for a specific post."""
    logger.info(f"Retrieving metrics for post {post_id}")
    
    # Verify post exists
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found"
        )
    
    query = db.query(PostMetric).filter(PostMetric.post_id == post_id)
    
    if platform:
        query = query.filter(PostMetric.platform == platform)
    
    # Filter by date range
    start_date = datetime.utcnow() - timedelta(days=days)
    query = query.filter(PostMetric.collected_at >= start_date)
    
    metrics = query.order_by(desc(PostMetric.collected_at)).all()
    return metrics


@router.put("/metrics/{metric_id}", response_model=PostMetricResponse)
async def update_post_metric(
    metric_id: UUID,
    metric_data: PostMetricUpdate,
    db: Session = Depends(get_db)
):
    """Update a post metric."""
    logger.info(f"Updating metric {metric_id}")
    
    metric = db.query(PostMetric).filter(PostMetric.id == metric_id).first()
    if not metric:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Metric not found"
        )
    
    try:
        update_data = metric_data.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(metric, field, value)
        
        db.commit()
        db.refresh(metric)
        
        logger.info(f"Updated metric {metric_id}")
        return metric
    except Exception as e:
        logger.error(f"Error updating metric {metric_id}: {e}", exc_info=True)
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update metric: {e}"
        )


# Analytics endpoints
@router.get("/posts/{post_id}/analytics", response_model=PostAnalytics)
async def get_post_analytics(
    post_id: UUID,
    days: int = Query(30, ge=1, le=365, description="Number of days to analyze"),
    db: Session = Depends(get_db)
):
    """Get analytics for a specific post."""
    logger.info(f"Retrieving analytics for post {post_id}")
    
    # Verify post exists
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found"
        )
    
    # Get metrics within date range
    start_date = datetime.utcnow() - timedelta(days=days)
    metrics = db.query(PostMetric).filter(
        PostMetric.post_id == post_id,
        PostMetric.collected_at >= start_date
    ).all()
    
    if not metrics:
        return PostAnalytics(
            post_id=post_id,
            total_impressions=0,
            total_clicks=0,
            total_conversions=0,
            total_revenue=0.0,
            average_ctr=0.0,
            average_conversion_rate=0.0,
            platform_breakdown=[]
        )
    
    # Calculate totals
    total_impressions = sum(m.impressions for m in metrics)
    total_clicks = sum(m.clicks for m in metrics)
    total_conversions = sum(m.conversions for m in metrics)
    total_revenue = sum(m.revenue for m in metrics)
    
    # Calculate averages
    average_ctr = total_clicks / total_impressions if total_impressions > 0 else 0.0
    average_conversion_rate = total_conversions / total_clicks if total_clicks > 0 else 0.0
    
    return PostAnalytics(
        post_id=post_id,
        total_impressions=total_impressions,
        total_clicks=total_clicks,
        total_conversions=total_conversions,
        total_revenue=total_revenue,
        average_ctr=average_ctr,
        average_conversion_rate=average_conversion_rate,
        platform_breakdown=metrics
    )


@router.get("/brands/{brand_id}/analytics", response_model=BrandAnalytics)
async def get_brand_analytics(
    brand_id: UUID,
    days: int = Query(30, ge=1, le=365, description="Number of days to analyze"),
    db: Session = Depends(get_db)
):
    """Get analytics for a brand."""
    logger.info(f"Retrieving analytics for brand {brand_id}")
    
    # Get posts within date range
    start_date = datetime.utcnow() - timedelta(days=days)
    posts = db.query(Post).filter(
        Post.brand_id == brand_id,
        Post.created_at >= start_date
    ).all()
    
    if not posts:
        return BrandAnalytics(
            brand_id=brand_id,
            total_posts=0,
            posts_by_variant={},
            total_impressions=0,
            total_clicks=0,
            total_conversions=0,
            total_revenue=0.0,
            best_performing_variant="",
            best_performing_platform=""
        )
    
    # Get all metrics for these posts
    post_ids = [post.id for post in posts]
    metrics = db.query(PostMetric).filter(
        PostMetric.post_id.in_(post_ids),
        PostMetric.collected_at >= start_date
    ).all()
    
    # Calculate brand-level metrics
    total_posts = len(posts)
    posts_by_variant = {}
    for post in posts:
        variant = post.variant
        posts_by_variant[variant] = posts_by_variant.get(variant, 0) + 1
    
    total_impressions = sum(m.impressions for m in metrics)
    total_clicks = sum(m.clicks for m in metrics)
    total_conversions = sum(m.conversions for m in metrics)
    total_revenue = sum(m.revenue for m in metrics)
    
    # Find best performing variant and platform
    variant_performance = {}
    platform_performance = {}
    
    for metric in metrics:
        # Group by variant
        post = next(p for p in posts if p.id == metric.post_id)
        variant = post.variant
        if variant not in variant_performance:
            variant_performance[variant] = {"revenue": 0, "conversions": 0}
        variant_performance[variant]["revenue"] += float(metric.revenue)
        variant_performance[variant]["conversions"] += metric.conversions
        
        # Group by platform
        platform = metric.platform
        if platform not in platform_performance:
            platform_performance[platform] = {"revenue": 0, "conversions": 0}
        platform_performance[platform]["revenue"] += float(metric.revenue)
        platform_performance[platform]["conversions"] += metric.conversions
    
    best_performing_variant = max(variant_performance.keys(), 
                                key=lambda v: variant_performance[v]["revenue"]) if variant_performance else ""
    best_performing_platform = max(platform_performance.keys(), 
                                 key=lambda p: platform_performance[p]["revenue"]) if platform_performance else ""
    
    return BrandAnalytics(
        brand_id=brand_id,
        total_posts=total_posts,
        posts_by_variant=posts_by_variant,
        total_impressions=total_impressions,
        total_clicks=total_clicks,
        total_conversions=total_conversions,
        total_revenue=total_revenue,
        best_performing_variant=best_performing_variant,
        best_performing_platform=best_performing_platform
    )



