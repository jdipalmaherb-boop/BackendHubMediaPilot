"""
FastAPI routes for simulation services.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.logging import logger
from app.simulation.simulator import SimulationRunner
from app.schemas.simulation import (
    CampaignSimulationRequest, CampaignSimulationResponse,
    AudienceSimulationRequest, AudienceSimulationResponse,
    CreativeSimulationRequest, CreativeSimulationResponse
)

router = APIRouter()


@router.post("/campaign", response_model=CampaignSimulationResponse, status_code=status.HTTP_200_OK)
async def run_campaign_simulation(
    request: CampaignSimulationRequest,
    db: Session = Depends(get_db),
    simulation_runner: SimulationRunner = Depends(SimulationRunner)
):
    """Run a complete campaign simulation."""
    logger.info(f"Received request to run campaign simulation for {request.campaign_config['campaign_id']}")
    try:
        result = await simulation_runner.run_campaign_simulation(
            campaign_config=request.campaign_config,
            optimization_config=request.optimization_config
        )
        return CampaignSimulationResponse(
            success=True,
            campaign_id=request.campaign_config['campaign_id'],
            result=result
        )
    except Exception as e:
        logger.error(f"Error running campaign simulation: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to run campaign simulation: {e}"
        )


@router.post("/audience", response_model=AudienceSimulationResponse, status_code=status.HTTP_200_OK)
async def run_audience_simulation(
    request: AudienceSimulationRequest,
    db: Session = Depends(get_db),
    simulation_runner: SimulationRunner = Depends(SimulationRunner)
):
    """Run audience performance simulation."""
    logger.info(f"Received request to run audience simulation for {request.audience_config['audience_id']}")
    try:
        result = await simulation_runner.run_audience_simulation(
            audience_config=request.audience_config
        )
        return AudienceSimulationResponse(
            success=True,
            audience_id=request.audience_config['audience_id'],
            result=result
        )
    except Exception as e:
        logger.error(f"Error running audience simulation: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to run audience simulation: {e}"
        )


@router.post("/creative", response_model=CreativeSimulationResponse, status_code=status.HTTP_200_OK)
async def run_creative_simulation(
    request: CreativeSimulationRequest,
    db: Session = Depends(get_db),
    simulation_runner: SimulationRunner = Depends(SimulationRunner)
):
    """Run creative performance simulation."""
    logger.info(f"Received request to run creative simulation for {request.creative_config['creative_id']}")
    try:
        result = await simulation_runner.run_creative_simulation(
            creative_config=request.creative_config
        )
        return CreativeSimulationResponse(
            success=True,
            creative_id=request.creative_config['creative_id'],
            result=result
        )
    except Exception as e:
        logger.error(f"Error running creative simulation: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to run creative simulation: {e}"
        )



