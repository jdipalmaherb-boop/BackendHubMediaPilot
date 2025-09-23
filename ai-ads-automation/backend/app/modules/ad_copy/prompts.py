"""
Sabri Suby style prompts and templates for ad copy generation.
"""

from typing import Dict, List


class SabriSubyPrompts:
    """Sabri Suby direct-response copywriting prompts and templates."""
    
    def __init__(self):
        self.pain_point_templates = self._get_pain_point_templates()
        self.solution_templates = self._get_solution_templates()
        self.offer_templates = self._get_offer_templates()
        self.urgency_templates = self._get_urgency_templates()
        self.social_proof_templates = self._get_social_proof_templates()
        self.guarantee_templates = self._get_guarantee_templates()
    
    def _get_pain_point_templates(self) -> List[str]:
        """Pain point templates that create emotional connection."""
        return [
            "Struggling with {problem} that's costing you {cost}?",
            "Tired of {problem} holding back your success?",
            "Frustrated with {problem} that never seems to get better?",
            "Worried that {problem} is destroying your {goal}?",
            "Sick of {problem} that's been plaguing you for {time}?",
            "Fed up with {problem} that's ruining your {outcome}?",
            "Exhausted from {problem} that's draining your {resource}?",
            "Angry about {problem} that's sabotaging your {dream}?",
            "Desperate to solve {problem} once and for all?",
            "Overwhelmed by {problem} that's taking over your life?"
        ]
    
    def _get_solution_templates(self) -> List[str]:
        """Solution templates that position the product as the answer."""
        return [
            "Finally, a proven solution that {benefit}",
            "What if I told you there's a way to {benefit}?",
            "Here's the breakthrough method that {benefit}",
            "The secret that {benefit} is finally revealed",
            "This revolutionary approach {benefit}",
            "The game-changing strategy that {benefit}",
            "The hidden technique that {benefit}",
            "The insider method that {benefit}",
            "The professional secret that {benefit}",
            "The advanced system that {benefit}"
        ]
    
    def _get_offer_templates(self) -> List[str]:
        """Clear offer templates with specific value propositions."""
        return [
            "Get {product} for just {price} (normally {regular_price})",
            "Limited time: {product} at {discount}% off",
            "Exclusive offer: {product} with {bonus}",
            "Special deal: {product} + {bonus} for {price}",
            "Today only: {product} for {price} (save {savings})",
            "One-time offer: {product} + {bonus} + {bonus2}",
            "Package deal: {product} + {bonus} + {bonus2} for {price}",
            "Complete system: {product} + {bonus} + {bonus2} + {bonus3}",
            "Ultimate package: Everything you need for {price}",
            "Full access: {product} + {bonus} + {bonus2} + {bonus3} + {bonus4}"
        ]
    
    def _get_urgency_templates(self) -> List[str]:
        """Urgency templates that create time pressure."""
        return [
            "But hurry - this offer expires in {time}",
            "Only {number} spots left at this price",
            "This deal won't last long",
            "Don't wait - {consequence}",
            "Act now before it's too late",
            "Limited time only - {time}",
            "First {number} people get {bonus}",
            "Only available for the next {time}",
            "This price disappears in {time}",
            "Last chance to get {product} at this price"
        ]
    
    def _get_social_proof_templates(self) -> List[str]:
        """Social proof templates that build credibility."""
        return [
            "Join {number}+ satisfied customers",
            "Trusted by {companies}",
            "Over {number} people have already {benefit}",
            "Rated {rating} stars by {number} users",
            "Featured in {publications}",
            "Used by {companies} worldwide",
            "Recommended by {experts}",
            "Endorsed by {authorities}",
            "Chosen by {number} professionals",
            "Loved by {number} users"
        ]
    
    def _get_guarantee_templates(self) -> List[str]:
        """Risk reversal templates that remove objections."""
        return [
            "100% money-back guarantee",
            "30-day risk-free trial",
            "If you're not satisfied, we'll refund every penny",
            "No questions asked refund policy",
            "Try it risk-free for {time}",
            "Full refund if you're not completely satisfied",
            "Money-back guarantee - no strings attached",
            "30-day satisfaction guarantee",
            "100% satisfaction or your money back",
            "Risk-free trial - cancel anytime"
        ]
    
    def get_headline_templates(self) -> List[str]:
        """Headline templates that grab attention."""
        return [
            "Finally! {solution} That Actually {benefit}",
            "The {adjective} {method} That {benefit}",
            "How to {achieve} Without {obstacle}",
            "The {secret} That {experts} Don't Want You to Know",
            "Why {problem} Happens (And How to {solution})",
            "The {adjective} {method} That {benefit} in {time}",
            "Stop {problem} Once and For All",
            "The {adjective} {solution} That {benefit}",
            "How {person} {achieved} Using This {method}",
            "The {secret} That {experts} Use to {benefit}"
        ]
    
    def get_cta_templates(self) -> List[str]:
        """Call-to-action templates that drive action."""
        return [
            "Get Started Now",
            "Claim Your Spot",
            "Download Free",
            "Start Your Trial",
            "Get Instant Access",
            "Join Now",
            "Try It Free",
            "Get It Now",
            "Learn More",
            "Sign Up Today",
            "Get Started",
            "Claim Yours",
            "Download Now",
            "Start Today",
            "Get Access"
        ]
    
    def build_sabri_suby_copy(
        self,
        product: str,
        problem: str,
        solution: str,
        benefit: str,
        offer: str,
        urgency: str,
        social_proof: str = "",
        guarantee: str = ""
    ) -> Dict[str, str]:
        """Build a complete Sabri Suby style ad copy."""
        
        # Select templates
        pain_template = self.pain_point_templates[0].format(problem=problem)
        solution_template = self.solution_templates[0].format(benefit=benefit)
        
        # Build primary text
        primary_text_parts = [pain_template, solution_template, offer]
        
        if urgency:
            primary_text_parts.append(urgency)
        
        if social_proof:
            primary_text_parts.append(social_proof)
        
        if guarantee:
            primary_text_parts.append(guarantee)
        
        primary_text = " ".join(primary_text_parts)
        
        return {
            "headline": f"Finally! {solution} That Actually {benefit}",
            "primary_text": primary_text,
            "cta": "Get Started Now",
            "style": "sabri_suby",
            "formula": {
                "pain": problem,
                "solution": solution,
                "offer": offer,
                "urgency": urgency,
                "social_proof": social_proof,
                "guarantee": guarantee
            }
        }
    
    def get_emotional_triggers(self) -> List[str]:
        """Common emotional triggers for ad copy."""
        return [
            "fear", "greed", "pride", "envy", "lust", "gluttony", "sloth",
            "curiosity", "urgency", "exclusivity", "scarcity", "authority",
            "social_proof", "reciprocity", "commitment", "consistency"
        ]
    
    def get_power_words(self) -> List[str]:
        """Power words that increase engagement."""
        return [
            "finally", "secret", "proven", "guaranteed", "exclusive",
            "limited", "instant", "free", "new", "revolutionary",
            "breakthrough", "discover", "reveal", "unlock", "transform",
            "amazing", "incredible", "stunning", "shocking", "surprising",
            "powerful", "effective", "successful", "profitable", "valuable"
        ]
    
    def get_urgency_words(self) -> List[str]:
        """Words that create urgency."""
        return [
            "now", "today", "immediately", "urgent", "hurry",
            "limited", "expires", "deadline", "last chance",
            "final", "ending soon", "act fast", "don't wait",
            "time-sensitive", "while supplies last"
        ]
    
    def get_benefit_words(self) -> List[str]:
        """Words that emphasize benefits."""
        return [
            "save", "earn", "gain", "achieve", "accomplish",
            "succeed", "win", "profit", "benefit", "advantage",
            "improve", "increase", "boost", "enhance", "optimize",
            "maximize", "minimize", "reduce", "eliminate", "solve"
        ]



