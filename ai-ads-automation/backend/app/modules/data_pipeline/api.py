"""
FastAPI routes for data pipeline services.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.logging import logger
from app.modules.data_pipeline.service import DataPipelineService
from app.schemas.data_pipeline import (
    DataIngestionRequest, DataIngestionResponse,
    DataProcessingRequest, DataProcessingResponse,
    DataValidationRequest, DataValidationResponse,
    DataStorageRequest, DataStorageResponse,
    DataRetrievalRequest, DataRetrievalResponse
)

router = APIRouter()


@router.post("/ingest", response_model=DataIngestionResponse, status_code=status.HTTP_200_OK)
async def ingest_data(
    request: DataIngestionRequest,
    db: Session = Depends(get_db),
    data_pipeline_service: DataPipelineService = Depends(DataPipelineService)
):
    """Ingest data from various sources."""
    logger.info(f"Received request to ingest data from {request.source}")
    try:
        result = await data_pipeline_service.ingest_data(
            source=request.source,
            data_type=request.data_type,
            data=request.data
        )
        return DataIngestionResponse(
            success=True,
            source=request.source,
            data_type=request.data_type,
            result=result
        )
    except Exception as e:
        logger.error(f"Error ingesting data: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to ingest data: {e}"
        )


@router.post("/process", response_model=DataProcessingResponse, status_code=status.HTTP_200_OK)
async def process_data(
    request: DataProcessingRequest,
    db: Session = Depends(get_db),
    data_pipeline_service: DataPipelineService = Depends(DataPipelineService)
):
    """Process ingested data."""
    logger.info(f"Received request to process data of type {request.data_type}")
    try:
        result = await data_pipeline_service.process_data(
            data_type=request.data_type,
            data=request.data,
            processing_options=request.processing_options
        )
        return DataProcessingResponse(
            success=True,
            data_type=request.data_type,
            result=result
        )
    except Exception as e:
        logger.error(f"Error processing data: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process data: {e}"
        )


@router.post("/validate", response_model=DataValidationResponse, status_code=status.HTTP_200_OK)
async def validate_data(
    request: DataValidationRequest,
    db: Session = Depends(get_db),
    data_pipeline_service: DataPipelineService = Depends(DataPipelineService)
):
    """Validate data quality and integrity."""
    logger.info(f"Received request to validate data of type {request.data_type}")
    try:
        result = await data_pipeline_service.validate_data(
            data_type=request.data_type,
            data=request.data,
            validation_rules=request.validation_rules
        )
        return DataValidationResponse(
            success=True,
            data_type=request.data_type,
            result=result
        )
    except Exception as e:
        logger.error(f"Error validating data: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to validate data: {e}"
        )


@router.post("/store", response_model=DataStorageResponse, status_code=status.HTTP_200_OK)
async def store_data(
    request: DataStorageRequest,
    db: Session = Depends(get_db),
    data_pipeline_service: DataPipelineService = Depends(DataPipelineService)
):
    """Store processed data."""
    logger.info(f"Received request to store data of type {request.data_type}")
    try:
        result = await data_pipeline_service.store_data(
            data_type=request.data_type,
            data=request.data,
            storage_options=request.storage_options
        )
        return DataStorageResponse(
            success=True,
            data_type=request.data_type,
            result=result
        )
    except Exception as e:
        logger.error(f"Error storing data: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to store data: {e}"
        )


@router.post("/retrieve", response_model=DataRetrievalResponse, status_code=status.HTTP_200_OK)
async def retrieve_data(
    request: DataRetrievalRequest,
    db: Session = Depends(get_db),
    data_pipeline_service: DataPipelineService = Depends(DataPipelineService)
):
    """Retrieve stored data."""
    logger.info(f"Received request to retrieve data of type {request.data_type}")
    try:
        result = await data_pipeline_service.retrieve_data(
            data_type=request.data_type,
            filters=request.filters,
            limit=request.limit,
            offset=request.offset
        )
        return DataRetrievalResponse(
            success=True,
            data_type=request.data_type,
            result=result
        )
    except Exception as e:
        logger.error(f"Error retrieving data: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve data: {e}"
        )



