# Simulation Environment

## Overview
The Simulation Environment provides offline testing capabilities for optimization algorithms and ad platform behavior. It simulates realistic ad performance data and allows testing of contextual bandits, reinforcement learning policies, and other optimization strategies without requiring real ad spend.

## Features
- **Ad Platform Simulation**: Simulates realistic ad performance metrics (ROAS, CPA, CTR, etc.) based on campaign parameters.
- **Audience Performance Simulation**: Simulates audience-specific performance characteristics.
- **Creative Performance Simulation**: Simulates creative-specific performance metrics.
- **Optimization Algorithm Simulation**: Tests contextual bandits and RL policies in a controlled environment.
- **Comprehensive Campaign Simulation**: Runs end-to-end simulations combining all components.

## Architecture
- `simulator.py`: Core simulation logic including `AdPlatformSimulator`, `OptimizationSimulator`, and `SimulationRunner`.
- `api.py`: FastAPI routes for running simulations.
- `schemas/simulation.py`: Pydantic models for request and response validation.

## Setup and Configuration
This module requires additional dependencies for simulation:
```bash
pip install numpy pandas
```

## API Endpoints

### `POST /api/v1/simulation/campaign`
Run a complete campaign simulation.

- **Request Body (`CampaignSimulationRequest`):**
    ```json
    {
        "campaign_config": {
            "campaign_id": "test_campaign_1",
            "start_date": "2023-10-01T00:00:00Z",
            "end_date": "2023-10-31T23:59:59Z",
            "budget_daily": 100.0,
            "targeting_criteria": {
                "demographics": {"age_min": 25, "age_max": 45, "gender": "any"},
                "interests": ["technology", "marketing"],
                "locations": ["US", "CA"]
            },
            "creative_variations": [
                {"type": "image", "headline": "Test Headline 1"},
                {"type": "video", "headline": "Test Headline 2"}
            ]
        },
        "optimization_config": {
            "arms": ["creative_1", "creative_2", "audience_1", "audience_2"],
            "contexts": [
                {"time_of_day": "morning", "day_of_week": "weekday"},
                {"time_of_day": "evening", "day_of_week": "weekend"}
            ],
            "num_rounds": 100
        }
    }
    ```
- **Response Body (`CampaignSimulationResponse`):**
    ```json
    {
        "success": true,
        "campaign_id": "test_campaign_1",
        "result": {
            "campaign_data": [
                {
                    "date": "2023-10-01",
                    "campaign_id": "test_campaign_1",
                    "spend": 95.2,
                    "impressions": 1200,
                    "clicks": 60,
                    "conversions": 6,
                    "roas": 2.1,
                    "cpa": 15.8,
                    "ctr": 0.05,
                    "cpm": 7.9
                }
            ],
            "optimization_results": {
                "selections": ["creative_1", "audience_1", "creative_2"],
                "rewards": {
                    "creative_1": [0.1, 0.15, 0.12],
                    "creative_2": [0.08, 0.11, 0.09]
                },
                "total_reward": 0.65
            },
            "simulation_summary": {
                "total_days": 31,
                "total_spend": 3100.0,
                "total_conversions": 186,
                "average_roas": 2.3,
                "average_cpa": 16.7
            }
        }
    }
    ```

### `POST /api/v1/simulation/audience`
Run audience performance simulation.

- **Request Body (`AudienceSimulationRequest`):**
    ```json
    {
        "audience_config": {
            "audience_id": "test_audience_1",
            "demographics": {
                "age_min": 25,
                "age_max": 45,
                "gender": "any"
            },
            "interests": ["technology", "marketing", "AI"],
            "days": 30
        }
    }
    ```
- **Response Body (`AudienceSimulationResponse`):**
    ```json
    {
        "success": true,
        "audience_id": "test_audience_1",
        "result": {
            "audience_data": [
                {
                    "date": "2023-10-01",
                    "audience_id": "test_audience_1",
                    "roas": 2.1,
                    "cpa": 18.5,
                    "reach": 950000
                }
            ],
            "simulation_summary": {
                "total_days": 30,
                "average_roas": 2.2,
                "average_cpa": 17.8,
                "average_reach": 980000
            }
        }
    }
    ```

### `POST /api/v1/simulation/creative`
Run creative performance simulation.

- **Request Body (`CreativeSimulationRequest`):**
    ```json
    {
        "creative_config": {
            "creative_id": "test_creative_1",
            "creative_type": "video",
            "ad_copy": {
                "headline": "Amazing Product Offer",
                "primary_text": "Limited time offer! Get 50% off today!",
                "cta_text": "Buy Now"
            },
            "days": 30
        }
    }
    ```
- **Response Body (`CreativeSimulationResponse`):**
    ```json
    {
        "success": true,
        "creative_id": "test_creative_1",
        "result": {
            "creative_data": [
                {
                    "date": "2023-10-01",
                    "creative_id": "test_creative_1",
                    "ctr": 0.06,
                    "cpm": 12.5,
                    "engagement_score": 0.75
                }
            ],
            "simulation_summary": {
                "total_days": 30,
                "average_ctr": 0.065,
                "average_cpm": 11.8,
                "average_engagement": 0.72
            }
        }
    }
    ```

## How to Use

### Running a Campaign Simulation
```python
from app.simulation.simulator import SimulationRunner

# Initialize simulator
simulator = SimulationRunner(seed=42)

# Configure campaign
campaign_config = {
    "campaign_id": "test_campaign",
    "start_date": datetime(2023, 10, 1),
    "end_date": datetime(2023, 10, 31),
    "budget_daily": 100.0,
    "targeting_criteria": {
        "demographics": {"age_min": 25, "age_max": 45},
        "interests": ["technology", "marketing"]
    },
    "creative_variations": [
        {"type": "image", "headline": "Test Headline"}
    ]
}

# Configure optimization
optimization_config = {
    "arms": ["creative_1", "creative_2"],
    "contexts": [{"time_of_day": "morning"}],
    "num_rounds": 100
}

# Run simulation
result = simulator.run_campaign_simulation(campaign_config, optimization_config)
```

### Running an Audience Simulation
```python
# Configure audience
audience_config = {
    "audience_id": "test_audience",
    "demographics": {"age_min": 25, "age_max": 45},
    "interests": ["technology", "marketing"],
    "days": 30
}

# Run simulation
result = simulator.run_audience_simulation(audience_config)
```

### Running a Creative Simulation
```python
# Configure creative
creative_config = {
    "creative_id": "test_creative",
    "creative_type": "video",
    "ad_copy": {
        "headline": "Amazing Product",
        "primary_text": "Get 50% off today!",
        "cta_text": "Buy Now"
    },
    "days": 30
}

# Run simulation
result = simulator.run_creative_simulation(creative_config)
```

## How to Extend / Integrate
- **Add More Realistic Simulation**: Enhance the simulation logic to include more realistic performance patterns, seasonality, and market dynamics.
- **Integrate with Real Data**: Use historical performance data to calibrate simulation parameters.
- **Add More Optimization Algorithms**: Implement additional optimization algorithms like genetic algorithms, simulated annealing, etc.
- **Add A/B Testing Simulation**: Simulate A/B testing scenarios to evaluate different strategies.



