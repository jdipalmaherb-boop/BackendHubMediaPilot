"""
FastAPI routes for brand voice assistant.
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.logging import logger
from app.modules.brand_voice.assistant import BrandVoiceAssistant
from app.schemas.brand_voice import (
    CaptionGenerateRequest, CaptionResponse,
    WinningExamplesRequest, WinningExamplesResponse,
    SimilarContentRequest, SimilarContentResponse,
    CaptionAnalyzeRequest, CaptionAnalyzeResponse,
    BrandVoiceStats, CaptionAnalysis
)

router = APIRouter()


@router.post("/generate", response_model=CaptionResponse, status_code=status.HTTP_200_OK)
async def generate_caption(
    request: CaptionGenerateRequest,
    db: Session = Depends(get_db),
    assistant: BrandVoiceAssistant = Depends(BrandVoiceAssistant)
):
    """Generate high-converting caption variants based on winning examples."""
    logger.info(f"Generating caption for brand: {request.brand}, platform: {request.platform}")
    
    try:
        result = await assistant.generate_caption(
            brand=request.brand,
            platform=request.platform,
            tone=request.tone,
            top_winning_examples=request.top_winning_examples,
            product_description=request.product_description,
            target_audience=request.target_audience
        )
        
        # Calculate character count
        character_count = len(result["primary"])
        
        return CaptionResponse(
            success=True,
            brand=request.brand,
            platform=request.platform,
            tone=request.tone,
            primary=result["primary"],
            alts=result["alts"],
            hashtags=result["hashtags"],
            cta=result["cta"],
            character_count=character_count,
            examples_used=len(request.top_winning_examples)
        )
    except Exception as e:
        logger.error(f"Error generating caption: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate caption: {e}"
        )


@router.post("/winning-examples", response_model=WinningExamplesResponse)
async def get_winning_examples(
    request: WinningExamplesRequest,
    assistant: BrandVoiceAssistant = Depends(BrandVoiceAssistant)
):
    """Get winning content examples for a brand."""
    logger.info(f"Getting winning examples for brand: {request.brand_id}")
    
    try:
        examples = await assistant.get_winning_examples_for_brand(
            brand_id=request.brand_id,
            limit=request.limit
        )
        
        return WinningExamplesResponse(
            success=True,
            brand_id=request.brand_id,
            examples=examples
        )
    except Exception as e:
        logger.error(f"Error getting winning examples: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get winning examples: {e}"
        )


@router.post("/search-similar", response_model=SimilarContentResponse)
async def search_similar_content(
    request: SimilarContentRequest,
    assistant: BrandVoiceAssistant = Depends(BrandVoiceAssistant)
):
    """Search for similar winning content to use as examples."""
    logger.info(f"Searching for similar content: {request.query_text[:50]}...")
    
    try:
        results = await assistant.search_similar_content(
            query_text=request.query_text,
            limit=request.limit
        )
        
        return SimilarContentResponse(
            success=True,
            query_text=request.query_text,
            results=results
        )
    except Exception as e:
        logger.error(f"Error searching similar content: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to search similar content: {e}"
        )


@router.post("/analyze", response_model=CaptionAnalyzeResponse)
async def analyze_caption(
    request: CaptionAnalyzeRequest,
    assistant: BrandVoiceAssistant = Depends(BrandVoiceAssistant)
):
    """Analyze a caption for conversion potential and optimization suggestions."""
    logger.info("Analyzing caption for conversion potential")
    
    try:
        analysis = await assistant.analyze_caption(request.caption)
        
        return CaptionAnalyzeResponse(
            success=True,
            analysis=analysis
        )
    except Exception as e:
        logger.error(f"Error analyzing caption: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to analyze caption: {e}"
        )


@router.get("/stats", response_model=BrandVoiceStats)
async def get_brand_voice_stats(
    assistant: BrandVoiceAssistant = Depends(BrandVoiceAssistant)
):
    """Get brand voice assistant statistics."""
    logger.info("Getting brand voice assistant stats")
    
    try:
        stats = await assistant.get_stats()
        
        return BrandVoiceStats(
            total_generations=stats.get("total_generations", 0),
            brands_served=stats.get("brands_served", 0),
            platforms_used=stats.get("platforms_used", []),
            average_character_count=stats.get("average_character_count", 0.0),
            success_rate=stats.get("success_rate", 0.0)
        )
    except Exception as e:
        logger.error(f"Error getting brand voice stats: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get brand voice stats: {e}"
        )


@router.post("/generate-with-feedback", response_model=CaptionResponse, status_code=status.HTTP_200_OK)
async def generate_caption_with_feedback(
    request: CaptionGenerateRequest,
    db: Session = Depends(get_db),
    assistant: BrandVoiceAssistant = Depends(BrandVoiceAssistant)
):
    """Generate caption using feedback loop to find winning examples automatically."""
    logger.info(f"Generating caption with feedback for brand: {request.brand}")
    
    try:
        # If no winning examples provided, get them from feedback loop
        if not request.top_winning_examples or len(request.top_winning_examples) == 0:
            # Try to get winning examples from feedback loop
            # For now, we'll use a generic brand ID based on brand name
            brand_id = request.brand.lower().replace(" ", "_")
            winning_examples = await assistant.get_winning_examples_for_brand(brand_id, 3)
        else:
            winning_examples = request.top_winning_examples
        
        result = await assistant.generate_caption(
            brand=request.brand,
            platform=request.platform,
            tone=request.tone,
            top_winning_examples=winning_examples,
            product_description=request.product_description,
            target_audience=request.target_audience
        )
        
        character_count = len(result["primary"])
        
        return CaptionResponse(
            success=True,
            brand=request.brand,
            platform=request.platform,
            tone=request.tone,
            primary=result["primary"],
            alts=result["alts"],
            hashtags=result["hashtags"],
            cta=result["cta"],
            character_count=character_count,
            examples_used=len(winning_examples)
        )
    except Exception as e:
        logger.error(f"Error generating caption with feedback: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate caption with feedback: {e}"
        )



