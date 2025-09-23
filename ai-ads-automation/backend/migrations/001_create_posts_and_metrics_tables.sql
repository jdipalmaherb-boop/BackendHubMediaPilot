-- Migration: Create posts and post_metrics tables
-- Description: Tables for tracking social media posts and their performance metrics

-- Create posts table
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL,
  variant TEXT NOT NULL CHECK (variant IN ('primary', 'A', 'B')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create post_metrics table
CREATE TABLE post_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  ctr FLOAT DEFAULT 0.0,
  conversions INTEGER DEFAULT 0,
  revenue NUMERIC(10,2) DEFAULT 0.0,
  collected_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX idx_posts_brand_id ON posts(brand_id);
CREATE INDEX idx_posts_variant ON posts(variant);
CREATE INDEX idx_posts_created_at ON posts(created_at);
CREATE INDEX idx_post_metrics_post_id ON post_metrics(post_id);
CREATE INDEX idx_post_metrics_platform ON post_metrics(platform);
CREATE INDEX idx_post_metrics_collected_at ON post_metrics(collected_at);

-- Add comments for documentation
COMMENT ON TABLE posts IS 'Stores social media posts with A/B testing variants';
COMMENT ON COLUMN posts.variant IS 'Post variant: primary, A, or B for A/B testing';
COMMENT ON COLUMN posts.content IS 'The actual post content (text, JSON, etc.)';

COMMENT ON TABLE post_metrics IS 'Stores performance metrics for posts across different platforms';
COMMENT ON COLUMN post_metrics.platform IS 'Social media platform (facebook, instagram, twitter, etc.)';
COMMENT ON COLUMN post_metrics.ctr IS 'Click-through rate (clicks/impressions)';
COMMENT ON COLUMN post_metrics.revenue IS 'Revenue generated from this post';



