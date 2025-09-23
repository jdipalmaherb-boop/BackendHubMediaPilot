"""
Tests for the Data Pipeline Service module.
"""

import pytest
from unittest.mock import Mock, patch
from app.modules.data_pipeline.service import DataPipelineService
from app.modules.data_pipeline.ingestion import DataIngestionService
from app.modules.data_pipeline.processing import DataProcessingService
from app.modules.data_pipeline.validation import DataValidationService
from app.modules.data_pipeline.storage import DataStorageService


class TestDataPipelineService:
    """Test cases for DataPipelineService."""

    @pytest.fixture
    def mock_ingestion_service(self):
        """Mock ingestion service for testing."""
        service = Mock(spec=DataIngestionService)
        service.ingest_data.return_value = {
            "source": "meta_ads",
            "data_type": "campaign_performance",
            "ingested_at": "2023-10-27T10:00:00Z",
            "records_count": 1,
            "status": "success"
        }
        return service

    @pytest.fixture
    def mock_processing_service(self):
        """Mock processing service for testing."""
        service = Mock(spec=DataProcessingService)
        service.process_data.return_value = {
            "data_type": "campaign_performance",
            "processed_at": "2023-10-27T10:00:00Z",
            "records_count": 1,
            "status": "success"
        }
        return service

    @pytest.fixture
    def mock_validation_service(self):
        """Mock validation service for testing."""
        service = Mock(spec=DataValidationService)
        service.validate_data.return_value = {
            "data_type": "campaign_performance",
            "validated_at": "2023-10-27T10:00:00Z",
            "validation_passed": True,
            "issues_found": 0,
            "status": "success"
        }
        return service

    @pytest.fixture
    def mock_storage_service(self):
        """Mock storage service for testing."""
        service = Mock(spec=DataStorageService)
        service.store_data.return_value = {
            "data_type": "campaign_performance",
            "stored_at": "2023-10-27T10:00:00Z",
            "records_count": 1,
            "status": "success"
        }
        service.retrieve_data.return_value = {
            "data_type": "campaign_performance",
            "retrieved_at": "2023-10-27T10:00:00Z",
            "records_count": 0,
            "status": "success"
        }
        return service

    @pytest.fixture
    def data_pipeline_service(self, mock_ingestion_service, mock_processing_service, mock_validation_service, mock_storage_service):
        """DataPipelineService instance with mocked dependencies."""
        return DataPipelineService(
            ingestion_service=mock_ingestion_service,
            processing_service=mock_processing_service,
            validation_service=mock_validation_service,
            storage_service=mock_storage_service
        )

    @pytest.mark.asyncio
    async def test_ingest_data(self, data_pipeline_service):
        """Test ingesting data."""
        result = await data_pipeline_service.ingest_data(
            source="meta_ads",
            data_type="campaign_performance",
            data={"records": [{"campaign_id": "123", "spend": 100.0}]}
        )

        assert result["source"] == "meta_ads"
        assert result["data_type"] == "campaign_performance"
        assert result["records_count"] == 1
        assert result["status"] == "success"

    @pytest.mark.asyncio
    async def test_process_data(self, data_pipeline_service):
        """Test processing data."""
        result = await data_pipeline_service.process_data(
            data_type="campaign_performance",
            data={"records": [{"campaign_id": "123", "spend": 100.0}]},
            processing_options={"calculate_metrics": True}
        )

        assert result["data_type"] == "campaign_performance"
        assert result["records_count"] == 1
        assert result["status"] == "success"

    @pytest.mark.asyncio
    async def test_validate_data(self, data_pipeline_service):
        """Test validating data."""
        result = await data_pipeline_service.validate_data(
            data_type="campaign_performance",
            data={"records": [{"campaign_id": "123", "spend": 100.0}]},
            validation_rules={"required_fields": ["campaign_id", "spend"]}
        )

        assert result["data_type"] == "campaign_performance"
        assert result["validation_passed"] == True
        assert result["issues_found"] == 0
        assert result["status"] == "success"

    @pytest.mark.asyncio
    async def test_store_data(self, data_pipeline_service):
        """Test storing data."""
        result = await data_pipeline_service.store_data(
            data_type="campaign_performance",
            data={"records": [{"campaign_id": "123", "spend": 100.0}]},
            storage_options={"table_name": "campaign_performance"}
        )

        assert result["data_type"] == "campaign_performance"
        assert result["records_count"] == 1
        assert result["status"] == "success"

    @pytest.mark.asyncio
    async def test_retrieve_data(self, data_pipeline_service):
        """Test retrieving data."""
        result = await data_pipeline_service.retrieve_data(
            data_type="campaign_performance",
            filters={"campaign_id": "123"},
            limit=100,
            offset=0
        )

        assert result["data_type"] == "campaign_performance"
        assert result["records_count"] == 0
        assert result["status"] == "success"

    @pytest.mark.asyncio
    async def test_ingest_data_exception(self, data_pipeline_service):
        """Test handling exception during data ingestion."""
        data_pipeline_service.ingestion_service.ingest_data.side_effect = Exception("Ingestion error")

        with pytest.raises(Exception):
            await data_pipeline_service.ingest_data(
                source="meta_ads",
                data_type="campaign_performance",
                data={"records": []}
            )

    @pytest.mark.asyncio
    async def test_process_data_exception(self, data_pipeline_service):
        """Test handling exception during data processing."""
        data_pipeline_service.processing_service.process_data.side_effect = Exception("Processing error")

        with pytest.raises(Exception):
            await data_pipeline_service.process_data(
                data_type="campaign_performance",
                data={"records": []},
                processing_options={}
            )

    @pytest.mark.asyncio
    async def test_validate_data_exception(self, data_pipeline_service):
        """Test handling exception during data validation."""
        data_pipeline_service.validation_service.validate_data.side_effect = Exception("Validation error")

        with pytest.raises(Exception):
            await data_pipeline_service.validate_data(
                data_type="campaign_performance",
                data={"records": []},
                validation_rules={}
            )

    @pytest.mark.asyncio
    async def test_store_data_exception(self, data_pipeline_service):
        """Test handling exception during data storage."""
        data_pipeline_service.storage_service.store_data.side_effect = Exception("Storage error")

        with pytest.raises(Exception):
            await data_pipeline_service.store_data(
                data_type="campaign_performance",
                data={"records": []},
                storage_options={}
            )

    @pytest.mark.asyncio
    async def test_retrieve_data_exception(self, data_pipeline_service):
        """Test handling exception during data retrieval."""
        data_pipeline_service.storage_service.retrieve_data.side_effect = Exception("Retrieval error")

        with pytest.raises(Exception):
            await data_pipeline_service.retrieve_data(
                data_type="campaign_performance",
                filters={},
                limit=100,
                offset=0
            )



