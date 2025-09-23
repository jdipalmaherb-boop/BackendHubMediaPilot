"""
AI-powered lead scoring system for webhook processing.
"""

import re
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass

from app.core.logging import logger
from app.modules.ad_copy.llm_client import get_llm_client, AbstractLLMClient


@dataclass
class LeadScore:
    """Lead scoring result."""
    score: int
    quality: str  # hot, warm, cold
    factors: List[str]
    confidence: float
    recommendations: List[str]
    next_actions: List[str]


class LeadScoringEngine:
    """AI-powered lead scoring engine."""

    def __init__(self, llm_client: Optional[AbstractLLMClient] = None):
        self.llm_client = llm_client if llm_client else get_llm_client()
        self.scoring_rules = self._load_scoring_rules()
        logger.info("LeadScoringEngine initialized")

    async def score_lead(
        self,
        form_data: Dict[str, Any],
        contact_data: Optional[Dict[str, Any]] = None,
        historical_data: Optional[Dict[str, Any]] = None
    ) -> LeadScore:
        """
        Score a lead using AI and rule-based analysis.
        
        Args:
            form_data: Form submission data
            contact_data: Contact information
            historical_data: Historical interaction data
            
        Returns:
            LeadScore object with detailed scoring information
        """
        logger.info("Scoring lead with AI-powered analysis")
        
        try:
            # Extract and clean form data
            cleaned_data = self._clean_form_data(form_data)
            
            # Calculate base score using rules
            base_score, rule_factors = self._calculate_rule_based_score(cleaned_data)
            
            # Get AI-powered insights
            ai_insights = await self._get_ai_insights(cleaned_data, contact_data, historical_data)
            
            # Combine scores and factors
            final_score = self._combine_scores(base_score, ai_insights.get("score_adjustment", 0))
            quality = self._determine_quality(final_score)
            
            # Generate recommendations
            recommendations = await self._generate_recommendations(
                final_score, quality, cleaned_data, ai_insights
            )
            
            # Generate next actions
            next_actions = await self._generate_next_actions(
                final_score, quality, cleaned_data, contact_data
            )
            
            # Calculate confidence
            confidence = self._calculate_confidence(rule_factors, ai_insights)
            
            return LeadScore(
                score=final_score,
                quality=quality,
                factors=rule_factors + ai_insights.get("factors", []),
                confidence=confidence,
                recommendations=recommendations,
                next_actions=next_actions
            )
            
        except Exception as e:
            logger.error(f"Error scoring lead: {e}", exc_info=True)
            return LeadScore(
                score=0,
                quality="unknown",
                factors=["Error in scoring"],
                confidence=0.0,
                recommendations=["Manual review required"],
                next_actions=["Contact support"]
            )

    def _clean_form_data(self, form_data: Dict[str, Any]) -> Dict[str, Any]:
        """Clean and normalize form data."""
        cleaned = {}
        
        for key, value in form_data.items():
            if isinstance(value, str):
                # Clean and normalize string values
                cleaned[key] = value.strip().lower()
            else:
                cleaned[key] = value
        
        return cleaned

    def _calculate_rule_based_score(self, data: Dict[str, Any]) -> Tuple[int, List[str]]:
        """Calculate base score using predefined rules."""
        score = 0
        factors = []
        
        # Email quality (0-25 points)
        email = data.get("email", "")
        if email:
            if self._is_valid_email(email):
                score += 15
                factors.append("Valid email address provided")
                
                # Check for business email
                if not any(domain in email for domain in ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com"]):
                    score += 10
                    factors.append("Business email domain")
        
        # Phone number (0-20 points)
        phone = data.get("phone", "")
        if phone:
            if self._is_valid_phone(phone):
                score += 20
                factors.append("Valid phone number provided")
        
        # Company information (0-15 points)
        company = data.get("company", "")
        if company:
            score += 10
            factors.append("Company information provided")
            
            # Check for enterprise indicators
            enterprise_keywords = ["inc", "corp", "llc", "ltd", "enterprise", "group", "holdings"]
            if any(keyword in company.lower() for keyword in enterprise_keywords):
                score += 5
                factors.append("Enterprise company indicators")
        
        # Job title (0-15 points)
        job_title = data.get("job_title", "") or data.get("title", "")
        if job_title:
            score += 10
            factors.append("Job title provided")
            
            # Check for decision maker titles
            decision_maker_titles = ["ceo", "cto", "cfo", "vp", "director", "manager", "head of"]
            if any(title in job_title.lower() for title in decision_maker_titles):
                score += 5
                factors.append("Decision maker title")
        
        # Budget information (0-25 points)
        budget = data.get("budget", "") or data.get("budget_range", "")
        if budget:
            budget_lower = budget.lower()
            if any(word in budget_lower for word in ["high", "large", "enterprise", "unlimited"]):
                score += 25
                factors.append("High budget indication")
            elif any(word in budget_lower for word in ["medium", "moderate", "reasonable"]):
                score += 15
                factors.append("Medium budget indication")
            elif any(word in budget_lower for word in ["low", "small", "limited"]):
                score += 5
                factors.append("Low budget indication")
        
        # Urgency indicators (0-20 points)
        message = data.get("message", "") or data.get("comments", "") or data.get("description", "")
        if message:
            urgency_words = ["urgent", "asap", "immediately", "quickly", "rush", "deadline", "critical"]
            urgency_count = sum(1 for word in urgency_words if word in message.lower())
            if urgency_count > 0:
                score += min(urgency_count * 5, 20)
                factors.append(f"Urgency indicators found ({urgency_count})")
        
        # Form completion (0-10 points)
        required_fields = ["email", "first_name", "last_name"]
        completed_fields = sum(1 for field in required_fields if data.get(field))
        if completed_fields == len(required_fields):
            score += 10
            factors.append("All required fields completed")
        elif completed_fields > 0:
            score += 5
            factors.append("Most required fields completed")
        
        # Source quality (0-15 points)
        source = data.get("source", "") or data.get("utm_source", "")
        if source:
            high_quality_sources = ["google", "linkedin", "referral", "direct"]
            if any(quality_source in source.lower() for quality_source in high_quality_sources):
                score += 15
                factors.append("High-quality traffic source")
            elif any(quality_source in source.lower() for quality_source in ["facebook", "twitter", "instagram"]):
                score += 10
                factors.append("Social media source")
            else:
                score += 5
                factors.append("Other traffic source")
        
        return min(score, 100), factors

    async def _get_ai_insights(
        self,
        form_data: Dict[str, Any],
        contact_data: Optional[Dict[str, Any]],
        historical_data: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Get AI-powered insights for lead scoring."""
        try:
            # Prepare context for AI analysis
            context = self._prepare_ai_context(form_data, contact_data, historical_data)
            
            # Use LLM to analyze the lead
            prompt = f"""
            Analyze this lead data and provide insights for scoring:
            
            Form Data: {form_data}
            Contact Data: {contact_data or "Not available"}
            Historical Data: {historical_data or "Not available"}
            
            Please provide:
            1. A score adjustment (-20 to +20) based on AI analysis
            2. Key factors that the AI identified
            3. Potential red flags or positive indicators
            4. Industry insights if applicable
            5. Behavioral patterns if historical data is available
            
            Return as JSON with keys: score_adjustment, factors, insights, red_flags, positive_indicators
            """
            
            response = await self.llm_client.generate_content(
                prompt=prompt,
                max_tokens=500,
                temperature=0.3
            )
            
            # Parse AI response (in production, this would be more robust)
            try:
                import json
                ai_data = json.loads(response)
                return ai_data
            except:
                # Fallback if JSON parsing fails
                return {
                    "score_adjustment": 0,
                    "factors": ["AI analysis completed"],
                    "insights": [response[:200] + "..." if len(response) > 200 else response],
                    "red_flags": [],
                    "positive_indicators": []
                }
                
        except Exception as e:
            logger.error(f"Error getting AI insights: {e}")
            return {
                "score_adjustment": 0,
                "factors": ["AI analysis failed"],
                "insights": [],
                "red_flags": [],
                "positive_indicators": []
            }

    def _prepare_ai_context(
        self,
        form_data: Dict[str, Any],
        contact_data: Optional[Dict[str, Any]],
        historical_data: Optional[Dict[str, Any]]
    ) -> str:
        """Prepare context for AI analysis."""
        context_parts = []
        
        # Form data context
        context_parts.append(f"Form submission: {form_data}")
        
        # Contact data context
        if contact_data:
            context_parts.append(f"Contact info: {contact_data}")
        
        # Historical data context
        if historical_data:
            context_parts.append(f"Historical interactions: {historical_data}")
        
        return "\n".join(context_parts)

    def _combine_scores(self, base_score: int, ai_adjustment: int) -> int:
        """Combine base score with AI adjustment."""
        final_score = base_score + ai_adjustment
        return max(0, min(final_score, 100))

    def _determine_quality(self, score: int) -> str:
        """Determine lead quality based on score."""
        if score >= 80:
            return "hot"
        elif score >= 50:
            return "warm"
        elif score >= 25:
            return "cold"
        else:
            return "unqualified"

    async def _generate_recommendations(
        self,
        score: int,
        quality: str,
        form_data: Dict[str, Any],
        ai_insights: Dict[str, Any]
    ) -> List[str]:
        """Generate recommendations based on lead score and quality."""
        recommendations = []
        
        if quality == "hot":
            recommendations.extend([
                "Immediate follow-up within 1 hour",
                "Assign to senior sales rep",
                "Prepare personalized demo",
                "Check for existing opportunities"
            ])
        elif quality == "warm":
            recommendations.extend([
                "Follow-up within 4 hours",
                "Send relevant case studies",
                "Schedule discovery call",
                "Add to nurture sequence"
            ])
        elif quality == "cold":
            recommendations.extend([
                "Add to automated nurture sequence",
                "Send educational content",
                "Follow up in 1-2 days",
                "Monitor for engagement"
            ])
        else:
            recommendations.extend([
                "Manual review required",
                "Verify contact information",
                "Consider lead qualification call"
            ])
        
        # Add AI-specific recommendations
        if ai_insights.get("red_flags"):
            recommendations.append("Review potential red flags identified by AI")
        
        if ai_insights.get("positive_indicators"):
            recommendations.append("Leverage positive indicators in outreach")
        
        return recommendations

    async def _generate_next_actions(
        self,
        score: int,
        quality: str,
        form_data: Dict[str, Any],
        contact_data: Optional[Dict[str, Any]]
    ) -> List[str]:
        """Generate specific next actions for the lead."""
        actions = []
        
        # Immediate actions based on quality
        if quality == "hot":
            actions.extend([
                "Send immediate welcome email with next steps",
                "Create calendar invite for discovery call",
                "Notify sales team via Slack/Teams",
                "Update CRM with lead score and notes"
            ])
        elif quality == "warm":
            actions.extend([
                "Send personalized follow-up email",
                "Add to high-priority nurture sequence",
                "Schedule follow-up call for tomorrow",
                "Research company and decision makers"
            ])
        else:
            actions.extend([
                "Add to standard nurture sequence",
                "Send educational content package",
                "Schedule follow-up for next week",
                "Monitor engagement metrics"
            ])
        
        # Specific actions based on form data
        if form_data.get("budget"):
            actions.append("Prepare budget-appropriate proposal")
        
        if form_data.get("company"):
            actions.append("Research company and industry")
        
        if form_data.get("phone"):
            actions.append("Prepare for phone conversation")
        
        return actions

    def _calculate_confidence(
        self,
        rule_factors: List[str],
        ai_insights: Dict[str, Any]
    ) -> float:
        """Calculate confidence score for the lead scoring."""
        # Base confidence on number of factors
        factor_count = len(rule_factors) + len(ai_insights.get("factors", []))
        
        # Confidence increases with more data points
        confidence = min(0.5 + (factor_count * 0.05), 0.95)
        
        # Adjust based on AI insights quality
        if ai_insights.get("insights"):
            confidence += 0.1
        
        return min(confidence, 1.0)

    def _is_valid_email(self, email: str) -> bool:
        """Validate email address format."""
        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        return bool(re.match(pattern, email))

    def _is_valid_phone(self, phone: str) -> bool:
        """Validate phone number format."""
        # Remove all non-digit characters
        digits_only = re.sub(r'\D', '', phone)
        # Check if it has 10-15 digits (international format)
        return 10 <= len(digits_only) <= 15

    def _load_scoring_rules(self) -> Dict[str, Any]:
        """Load scoring rules configuration."""
        return {
            "email_weight": 25,
            "phone_weight": 20,
            "company_weight": 15,
            "job_title_weight": 15,
            "budget_weight": 25,
            "urgency_weight": 20,
            "completion_weight": 10,
            "source_weight": 15,
            "ai_adjustment_range": (-20, 20)
        }

    async def batch_score_leads(self, leads: List[Dict[str, Any]]) -> List[LeadScore]:
        """Score multiple leads in batch."""
        logger.info(f"Batch scoring {len(leads)} leads")
        
        scores = []
        for lead_data in leads:
            try:
                score = await self.score_lead(lead_data)
                scores.append(score)
            except Exception as e:
                logger.error(f"Error scoring lead in batch: {e}")
                # Add error score
                scores.append(LeadScore(
                    score=0,
                    quality="error",
                    factors=[f"Scoring error: {e}"],
                    confidence=0.0,
                    recommendations=["Manual review required"],
                    next_actions=["Contact support"]
                ))
        
        return scores

    async def get_scoring_analytics(self, scores: List[LeadScore]) -> Dict[str, Any]:
        """Get analytics for a batch of lead scores."""
        if not scores:
            return {"message": "No scores to analyze"}
        
        total_leads = len(scores)
        hot_leads = sum(1 for s in scores if s.quality == "hot")
        warm_leads = sum(1 for s in scores if s.quality == "warm")
        cold_leads = sum(1 for s in scores if s.quality == "cold")
        
        avg_score = sum(s.score for s in scores) / total_leads
        avg_confidence = sum(s.confidence for s in scores) / total_leads
        
        # Most common factors
        all_factors = []
        for score in scores:
            all_factors.extend(score.factors)
        
        factor_counts = {}
        for factor in all_factors:
            factor_counts[factor] = factor_counts.get(factor, 0) + 1
        
        common_factors = sorted(factor_counts.items(), key=lambda x: x[1], reverse=True)[:5]
        
        return {
            "total_leads": total_leads,
            "quality_distribution": {
                "hot": hot_leads,
                "warm": warm_leads,
                "cold": cold_leads,
                "unqualified": total_leads - hot_leads - warm_leads - cold_leads
            },
            "average_score": round(avg_score, 2),
            "average_confidence": round(avg_confidence, 2),
            "common_factors": common_factors,
            "scoring_summary": {
                "high_quality_rate": round((hot_leads + warm_leads) / total_leads * 100, 2),
                "hot_lead_rate": round(hot_leads / total_leads * 100, 2)
            }
        }



