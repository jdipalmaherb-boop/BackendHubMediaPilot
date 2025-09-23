"""
FastAPI routes for marketing analytics services.
"""

from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.logging import logger
from app.modules.analytics.marketing_analyst import MarketingAnalyst
from app.schemas.analytics import (
    MarketingAnalysisRequest, MarketingAnalysisResponse,
    QuickAnalysisRequest, QuickAnalysisResponse,
    TrendAnalysisRequest, TrendAnalysisResponse,
    PerformanceInsightsRequest, PerformanceInsightsResponse,
    CustomAnalysisRequest, CustomAnalysisResponse,
    AnalyticsStats
)

router = APIRouter()


@router.post("/analyze", response_model=MarketingAnalysisResponse, status_code=status.HTTP_200_OK)
async def analyze_marketing_performance(
    request: MarketingAnalysisRequest,
    analyst: MarketingAnalyst = Depends(MarketingAnalyst)
):
    """Analyze marketing performance data and generate actionable insights."""
    logger.info("Analyzing marketing performance data")
    
    try:
        analysis = await analyst.analyze_performance_data(
            json_metrics=request.json_metrics,
            analysis_period=request.analysis_period
        )
        
        return MarketingAnalysisResponse(
            success=True,
            analysis_period=analysis["analysis_period"],
            data_summary=analysis["data_summary"],
            top_3_wins=analysis["top_3_wins"],
            bottom_2_problems=analysis["bottom_2_problems"],
            next_actions=analysis["next_actions"],
            optimal_posting_times=analysis["optimal_posting_times"],
            performance_trends=analysis["performance_trends"],
            recommendations=analysis["recommendations"],
            generated_at=analysis.get("generated_at", "2023-10-27T10:00:00Z")
        )
    except Exception as e:
        logger.error(f"Error analyzing marketing performance: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to analyze marketing performance: {e}"
        )


@router.post("/quick-analysis", response_model=QuickAnalysisResponse, status_code=status.HTTP_200_OK)
async def quick_analysis(
    request: QuickAnalysisRequest,
    analyst: MarketingAnalyst = Depends(MarketingAnalyst)
):
    """Perform a quick analysis with plain English summary."""
    logger.info("Performing quick marketing analysis")
    
    try:
        # Perform full analysis
        full_analysis = await analyst.analyze_performance_data(
            json_metrics=request.json_metrics,
            analysis_period="6_weeks"
        )
        
        # Generate plain English summary
        summary = _generate_plain_english_summary(full_analysis)
        
        # Extract key insights
        key_insights = _extract_key_insights(full_analysis)
        
        # Extract immediate actions
        immediate_actions = _extract_immediate_actions(full_analysis)
        
        return QuickAnalysisResponse(
            success=True,
            summary=summary,
            key_insights=key_insights,
            immediate_actions=immediate_actions,
            generated_at="2023-10-27T10:00:00Z"
        )
    except Exception as e:
        logger.error(f"Error performing quick analysis: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to perform quick analysis: {e}"
        )


@router.post("/trend-analysis", response_model=TrendAnalysisResponse, status_code=status.HTTP_200_OK)
async def analyze_trends(
    request: TrendAnalysisRequest,
    analyst: MarketingAnalyst = Depends(MarketingAnalyst)
):
    """Analyze specific trends in the data."""
    logger.info(f"Analyzing {request.trend_type} trends")
    
    try:
        # Perform full analysis
        full_analysis = await analyst.analyze_performance_data(
            json_metrics=request.json_metrics,
            analysis_period=request.time_period
        )
        
        # Extract trend-specific information
        trends = full_analysis.get("performance_trends", {})
        
        trend_direction = trends.get("engagement_trend", "stable")
        trend_strength = _calculate_trend_strength(trends)
        
        # Generate trend-based recommendations
        recommendations = _generate_trend_recommendations(trends, request.trend_type)
        
        return TrendAnalysisResponse(
            success=True,
            trend_type=request.trend_type,
            time_period=request.time_period,
            trend_direction=trend_direction,
            trend_strength=trend_strength,
            data_points=full_analysis.get("data_summary", {}),
            predictions=full_analysis.get("optimal_posting_times", []),
            recommendations=recommendations
        )
    except Exception as e:
        logger.error(f"Error analyzing trends: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to analyze trends: {e}"
        )


@router.post("/performance-insights", response_model=PerformanceInsightsResponse, status_code=status.HTTP_200_OK)
async def get_performance_insights(
    request: PerformanceInsightsRequest,
    analyst: MarketingAnalyst = Depends(MarketingAnalyst)
):
    """Get comprehensive performance insights."""
    logger.info("Generating performance insights")
    
    try:
        # Perform full analysis
        full_analysis = await analyst.analyze_performance_data(
            json_metrics=request.json_metrics,
            analysis_period="6_weeks"
        )
        
        # Calculate performance score
        performance_score = _calculate_performance_score(full_analysis)
        
        # Extract strengths and weaknesses
        strengths = _extract_strengths(full_analysis)
        weaknesses = _extract_weaknesses(full_analysis)
        
        # Generate opportunities and threats
        opportunities = _generate_opportunities(full_analysis)
        threats = _generate_threats(full_analysis)
        
        # Generate benchmarks if requested
        benchmarks = {}
        if request.include_benchmarks:
            benchmarks = _generate_benchmarks(full_analysis)
        
        # Create action plan
        action_plan = _create_action_plan(full_analysis)
        
        return PerformanceInsightsResponse(
            success=True,
            insight_type=request.insight_type,
            performance_score=performance_score,
            strengths=strengths,
            weaknesses=weaknesses,
            opportunities=opportunities,
            threats=threats,
            benchmarks=benchmarks,
            action_plan=action_plan
        )
    except Exception as e:
        logger.error(f"Error generating performance insights: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate performance insights: {e}"
        )


@router.post("/custom-analysis", response_model=CustomAnalysisResponse, status_code=status.HTTP_200_OK)
async def custom_analysis(
    request: CustomAnalysisRequest,
    analyst: MarketingAnalyst = Depends(MarketingAnalyst)
):
    """Perform custom analysis based on specific goals and questions."""
    logger.info("Performing custom analysis")
    
    try:
        # Perform full analysis
        full_analysis = await analyst.analyze_performance_data(
            json_metrics=request.json_metrics,
            analysis_period="6_weeks"
        )
        
        # Answer custom questions
        custom_answers = _answer_custom_questions(request.custom_questions, full_analysis)
        
        # Generate findings based on goals
        findings = _generate_custom_findings(request.analysis_goals, full_analysis)
        
        # Generate conclusions
        conclusions = _generate_conclusions(full_analysis, request.analysis_goals)
        
        # Generate next steps
        next_steps = _generate_next_steps(full_analysis, request.analysis_goals)
        
        return CustomAnalysisResponse(
            success=True,
            analysis_goals=request.analysis_goals,
            custom_questions=custom_answers,
            findings=findings,
            conclusions=conclusions,
            next_steps=next_steps,
            generated_at="2023-10-27T10:00:00Z"
        )
    except Exception as e:
        logger.error(f"Error performing custom analysis: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to perform custom analysis: {e}"
        )


@router.get("/stats", response_model=AnalyticsStats)
async def get_analytics_stats():
    """Get analytics system statistics."""
    logger.info("Getting analytics stats")
    
    try:
        # This would typically come from a database or analytics service
        # For now, return mock stats
        stats = {
            "total_analyses": 0,
            "avg_analysis_time": 0.0,
            "most_common_insights": [],
            "success_rate": 100.0,
            "platforms_analyzed": [],
            "avg_performance_score": 0.0
        }
        
        return AnalyticsStats(**stats)
    except Exception as e:
        logger.error(f"Error getting analytics stats: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get analytics stats: {e}"
        )


# Helper functions

def _generate_plain_english_summary(analysis: Dict[str, Any]) -> str:
    """Generate a plain English summary of the analysis."""
    data_summary = analysis.get("data_summary", {})
    wins = analysis.get("top_3_wins", [])
    problems = analysis.get("bottom_2_problems", [])
    actions = analysis.get("next_actions", [])
    posting_times = analysis.get("optimal_posting_times", [])
    
    summary_parts = []
    
    # Data overview
    total_posts = data_summary.get("total_posts", 0)
    avg_engagement = data_summary.get("avg_engagement_rate", 0)
    summary_parts.append(f"Analyzed {total_posts} posts with an average engagement rate of {avg_engagement:.1%}.")
    
    # Top wins
    if wins:
        best_win = wins[0]
        summary_parts.append(f"Your best performing content achieved {best_win['value']:.1%} engagement rate.")
    
    # Main problems
    if problems:
        main_problem = problems[0]
        summary_parts.append(f"Your lowest performing content only reached {main_problem['value']:.1%} engagement rate.")
    
    # Key actions
    if actions:
        top_action = actions[0]
        summary_parts.append(f"Priority action: {top_action['title']} - {top_action['description']}")
    
    # Optimal posting
    if posting_times:
        best_time = posting_times[0]
        summary_parts.append(f"Best time to post: {best_time['day']} at {best_time['time']} (confidence: {best_time['confidence']:.0%})")
    
    return " ".join(summary_parts)


def _extract_key_insights(analysis: Dict[str, Any]) -> list:
    """Extract key insights from the analysis."""
    insights = []
    
    wins = analysis.get("top_3_wins", [])
    if wins:
        insights.append(f"Your top content achieved {wins[0]['value']:.1%} engagement rate")
    
    problems = analysis.get("bottom_2_problems", [])
    if problems:
        insights.append(f"Content with {problems[0]['value']:.1%} engagement needs improvement")
    
    trends = analysis.get("performance_trends", {})
    if trends.get("engagement_trend") == "increasing":
        insights.append("Engagement is trending upward - great work!")
    elif trends.get("engagement_trend") == "decreasing":
        insights.append("Engagement is declining - immediate action needed")
    
    return insights


def _extract_immediate_actions(analysis: Dict[str, Any]) -> list:
    """Extract immediate actions from the analysis."""
    actions = analysis.get("next_actions", [])
    immediate_actions = []
    
    for action in actions[:3]:  # Top 3 actions
        immediate_actions.append(f"{action['title']}: {action['description']}")
    
    return immediate_actions


def _calculate_trend_strength(trends: Dict[str, Any]) -> str:
    """Calculate the strength of trends."""
    engagement_trend = trends.get("engagement_trend", "stable")
    reach_trend = trends.get("reach_trend", "stable")
    
    if engagement_trend == "increasing" and reach_trend == "increasing":
        return "strong"
    elif engagement_trend == "increasing" or reach_trend == "increasing":
        return "moderate"
    else:
        return "weak"


def _generate_trend_recommendations(trends: Dict[str, Any], trend_type: str) -> list:
    """Generate recommendations based on trends."""
    recommendations = []
    
    engagement_trend = trends.get("engagement_trend", "stable")
    reach_trend = trends.get("reach_trend", "stable")
    
    if engagement_trend == "increasing":
        recommendations.append("Continue current engagement strategies - they're working!")
    elif engagement_trend == "decreasing":
        recommendations.append("Urgent: Review and improve content quality to reverse engagement decline")
    
    if reach_trend == "increasing":
        recommendations.append("Great reach growth! Consider expanding to new platforms")
    elif reach_trend == "decreasing":
        recommendations.append("Focus on increasing content visibility and discoverability")
    
    return recommendations


def _calculate_performance_score(analysis: Dict[str, Any]) -> float:
    """Calculate overall performance score."""
    data_summary = analysis.get("data_summary", {})
    avg_engagement = data_summary.get("avg_engagement_rate", 0)
    
    # Simple scoring based on engagement rate
    if avg_engagement >= 0.05:
        return 90.0
    elif avg_engagement >= 0.03:
        return 70.0
    elif avg_engagement >= 0.02:
        return 50.0
    else:
        return 30.0


def _extract_strengths(analysis: Dict[str, Any]) -> list:
    """Extract performance strengths."""
    strengths = []
    
    wins = analysis.get("top_3_wins", [])
    if wins:
        strengths.append("High-performing content that drives engagement")
    
    trends = analysis.get("performance_trends", {})
    if trends.get("engagement_trend") == "increasing":
        strengths.append("Growing engagement trend")
    
    return strengths


def _extract_weaknesses(analysis: Dict[str, Any]) -> list:
    """Extract performance weaknesses."""
    weaknesses = []
    
    problems = analysis.get("bottom_2_problems", [])
    if problems:
        weaknesses.append("Some content underperforming significantly")
    
    trends = analysis.get("performance_trends", {})
    if trends.get("engagement_trend") == "decreasing":
        weaknesses.append("Declining engagement trend")
    
    return weaknesses


def _generate_opportunities(analysis: Dict[str, Any]) -> list:
    """Generate growth opportunities."""
    opportunities = []
    
    posting_times = analysis.get("optimal_posting_times", [])
    if posting_times:
        opportunities.append("Optimize posting schedule for better engagement")
    
    opportunities.append("Expand to new content formats and platforms")
    opportunities.append("Implement advanced analytics and tracking")
    
    return opportunities


def _generate_threats(analysis: Dict[str, Any]) -> list:
    """Generate potential threats."""
    threats = []
    
    trends = analysis.get("performance_trends", {})
    if trends.get("engagement_trend") == "decreasing":
        threats.append("Risk of continued engagement decline")
    
    threats.append("Competition for audience attention")
    threats.append("Platform algorithm changes")
    
    return threats


def _generate_benchmarks(analysis: Dict[str, Any]) -> Dict[str, Any]:
    """Generate industry benchmarks."""
    return {
        "industry_avg_engagement": 0.03,
        "top_performers_engagement": 0.06,
        "recommended_posting_frequency": "3-5 posts per week",
        "optimal_posting_times": ["9:00 AM", "1:00 PM", "5:00 PM"]
    }


def _create_action_plan(analysis: Dict[str, Any]) -> list:
    """Create action plan based on analysis."""
    actions = analysis.get("next_actions", [])
    action_plan = []
    
    for action in actions:
        action_plan.append({
            "action": action["title"],
            "description": action["description"],
            "priority": action["priority"],
            "timeline": action["timeline"],
            "expected_impact": action["expected_impact"]
        })
    
    return action_plan


def _answer_custom_questions(questions: list, analysis: Dict[str, Any]) -> list:
    """Answer custom questions based on analysis."""
    answers = []
    
    for question in questions:
        # Simple keyword-based answering
        if "engagement" in question.lower():
            avg_engagement = analysis.get("data_summary", {}).get("avg_engagement_rate", 0)
            answers.append({
                "question": question,
                "answer": f"Your average engagement rate is {avg_engagement:.1%}"
            })
        elif "best time" in question.lower():
            posting_times = analysis.get("optimal_posting_times", [])
            if posting_times:
                best_time = posting_times[0]
                answers.append({
                    "question": question,
                    "answer": f"Best time to post is {best_time['day']} at {best_time['time']}"
                })
            else:
                answers.append({
                    "question": question,
                    "answer": "Insufficient data to determine optimal posting time"
                })
        else:
            answers.append({
                "question": question,
                "answer": "Analysis completed - see detailed findings below"
            })
    
    return answers


def _generate_custom_findings(goals: list, analysis: Dict[str, Any]) -> list:
    """Generate findings based on custom goals."""
    findings = []
    
    for goal in goals:
        if "engagement" in goal.lower():
            findings.append({
                "goal": goal,
                "finding": f"Current engagement rate: {analysis.get('data_summary', {}).get('avg_engagement_rate', 0):.1%}",
                "status": "needs_improvement" if analysis.get('data_summary', {}).get('avg_engagement_rate', 0) < 0.03 else "good"
            })
        elif "reach" in goal.lower():
            findings.append({
                "goal": goal,
                "finding": f"Total reach: {analysis.get('data_summary', {}).get('total_reach', 0):,}",
                "status": "good"
            })
        else:
            findings.append({
                "goal": goal,
                "finding": "Analysis completed for this goal",
                "status": "completed"
            })
    
    return findings


def _generate_conclusions(analysis: Dict[str, Any], goals: list) -> list:
    """Generate conclusions based on analysis and goals."""
    conclusions = []
    
    data_summary = analysis.get("data_summary", {})
    avg_engagement = data_summary.get("avg_engagement_rate", 0)
    
    if avg_engagement >= 0.03:
        conclusions.append("Overall performance is strong with good engagement rates")
    else:
        conclusions.append("Performance needs improvement - focus on content quality and engagement")
    
    trends = analysis.get("performance_trends", {})
    if trends.get("engagement_trend") == "increasing":
        conclusions.append("Positive trend detected - continue current strategies")
    elif trends.get("engagement_trend") == "decreasing":
        conclusions.append("Declining trend requires immediate attention")
    
    return conclusions


def _generate_next_steps(analysis: Dict[str, Any], goals: list) -> list:
    """Generate next steps based on analysis and goals."""
    next_steps = []
    
    actions = analysis.get("next_actions", [])
    for action in actions[:3]:  # Top 3 actions
        next_steps.append(f"Implement: {action['title']} ({action['timeline']})")
    
    return next_steps



