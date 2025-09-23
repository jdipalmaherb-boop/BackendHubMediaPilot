"""
Data pipeline service for data ingestion, processing, validation, and storage.
"""

from typing import Any, Dict, List, Optional
from app.core.logging import logger
from app.modules.data_pipeline.ingestion import DataIngestionService
from app.modules.data_pipeline.processing import DataProcessingService
from app.modules.data_pipeline.validation import DataValidationService
from app.modules.data_pipeline.storage import DataStorageService


class DataPipelineService:
    """Service for data pipeline functionality."""

    def __init__(
        self,
        ingestion_service: Optional[DataIngestionService] = None,
        processing_service: Optional[DataProcessingService] = None,
        validation_service: Optional[DataValidationService] = None,
        storage_service: Optional[DataStorageService] = None
    ):
        self.ingestion_service = ingestion_service if ingestion_service else DataIngestionService()
        self.processing_service = processing_service if processing_service else DataProcessingService()
        self.validation_service = validation_service if validation_service else DataValidationService()
        self.storage_service = storage_service if storage_service else DataStorageService()
        logger.info("DataPipelineService initialized.")

    async def ingest_data(
        self,
        source: str,
        data_type: str,
        data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Ingest data from various sources."""
        logger.info(f"Ingesting data from {source} of type {data_type}")
        try:
            result = await self.ingestion_service.ingest_data(
                source=source,
                data_type=data_type,
                data=data
            )
            return result
        except Exception as e:
            logger.error(f"Error ingesting data: {e}", exc_info=True)
            raise

    async def process_data(
        self,
        data_type: str,
        data: Dict[str, Any],
        processing_options: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Process ingested data."""
        logger.info(f"Processing data of type {data_type}")
        try:
            result = await self.processing_service.process_data(
                data_type=data_type,
                data=data,
                processing_options=processing_options
            )
            return result
        except Exception as e:
            logger.error(f"Error processing data: {e}", exc_info=True)
            raise

    async def validate_data(
        self,
        data_type: str,
        data: Dict[str, Any],
        validation_rules: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Validate data quality and integrity."""
        logger.info(f"Validating data of type {data_type}")
        try:
            result = await self.validation_service.validate_data(
                data_type=data_type,
                data=data,
                validation_rules=validation_rules
            )
            return result
        except Exception as e:
            logger.error(f"Error validating data: {e}", exc_info=True)
            raise

    async def store_data(
        self,
        data_type: str,
        data: Dict[str, Any],
        storage_options: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Store processed data."""
        logger.info(f"Storing data of type {data_type}")
        try:
            result = await self.storage_service.store_data(
                data_type=data_type,
                data=data,
                storage_options=storage_options
            )
            return result
        except Exception as e:
            logger.error(f"Error storing data: {e}", exc_info=True)
            raise

    async def retrieve_data(
        self,
        data_type: str,
        filters: Optional[Dict[str, Any]] = None,
        limit: Optional[int] = None,
        offset: Optional[int] = None
    ) -> Dict[str, Any]:
        """Retrieve stored data."""
        logger.info(f"Retrieving data of type {data_type}")
        try:
            result = await self.storage_service.retrieve_data(
                data_type=data_type,
                filters=filters,
                limit=limit,
                offset=offset
            )
            return result
        except Exception as e:
            logger.error(f"Error retrieving data: {e}", exc_info=True)
            raise



