# Optimization Engine Module

This module handles the optimization of ad campaigns using advanced machine learning techniques including contextual bandits and reinforcement learning.

## Features

- **Contextual Bandit**: Thompson sampling for bid strategy optimization
- **Reinforcement Learning**: PPO-based policy for budget allocation
- **Budget Allocation**: Multiple strategies for optimal budget distribution
- **Performance Optimization**: Real-time campaign optimization
- **Multi-Objective Optimization**: Support for ROAS, CPA, and conversion goals

## Architecture

```
OptimizationEngine
├── ContextualBandit      # Bid strategy optimization
├── RLPolicy             # Budget allocation policy
├── BudgetAllocator      # Budget distribution strategies
└── PerformanceAnalyzer  # Performance analysis and insights
```

## Usage

### Optimize Campaign

```python
from app.modules.optimization import OptimizationEngine

engine = OptimizationEngine()

# Optimize a campaign
result = await engine.optimize_campaign(
    db=db,
    campaign_id="campaign_123",
    optimization_goals={
        "maximize_roas": True,
        "minimize_cpa": True,
        "target_roas": 3.0
    },
    constraints={
        "max_daily_budget": 1000,
        "min_daily_budget": 100
    }
)
```

### Allocate Budget

```python
from app.modules.optimization import BudgetAllocator

allocator = BudgetAllocator()

# Allocate budget across ad groups
allocation = await allocator.allocate_budget(
    total_budget=1000.0,
    ad_groups=[
        {"id": "ag1", "roas": 3.2, "ctr": 0.025, "conversion_rate": 0.08},
        {"id": "ag2", "roas": 2.8, "ctr": 0.020, "conversion_rate": 0.06}
    ],
    allocation_strategy="performance_based"
)
```

### Use Contextual Bandit

```python
from app.modules.optimization import ContextualBandit

bandit = ContextualBandit()

# Optimize bid strategy
strategy = await bandit.optimize_bid_strategy(
    campaign=campaign,
    performance_data=performance_data,
    optimization_goals=goals,
    constraints=constraints
)
```

## Optimization Strategies

### Contextual Bandit
- **Thompson Sampling**: Bayesian approach for exploration vs exploitation
- **Feature Engineering**: Context-aware bid strategy selection
- **Multi-Armed Bandit**: Multiple bid strategies (Target CPA, Target ROAS, etc.)

### Reinforcement Learning
- **Policy Network**: Neural network for budget allocation decisions
- **Experience Replay**: Learning from historical performance data
- **Epsilon-Greedy**: Balanced exploration and exploitation

### Budget Allocation
- **Performance-Based**: Allocate based on ad group performance
- **ROAS-Optimized**: Maximize return on ad spend
- **CPA-Optimized**: Minimize cost per acquisition
- **Equal Distribution**: Equal allocation across ad groups

## API Endpoints

- `POST /api/v1/optimization/optimize` - Optimize a campaign
- `POST /api/v1/optimization/budget/allocate` - Allocate budget across ad groups
- `GET /api/v1/optimization/health` - Health check

## Configuration

Set the following environment variables:

```bash
# RL Policy settings
RL_LEARNING_RATE=0.001
RL_GAMMA=0.99
RL_EPSILON=0.1
RL_EPSILON_DECAY=0.995

# Contextual Bandit settings
BANDIT_ALPHA=1.0
BANDIT_BETA=1.0
BANDIT_N_ARMS=5

# Budget allocation settings
BUDGET_MIN_ALLOCATION=10.0
BUDGET_MAX_ALLOCATION=1000.0
```

## Testing

Run the optimization module tests:

```bash
pytest backend/tests/modules/test_optimization.py -v
```

## Dependencies

- `numpy` - Numerical computations
- `scikit-learn` - Machine learning algorithms
- `sqlalchemy` - Database operations
- `pydantic` - Data validation



