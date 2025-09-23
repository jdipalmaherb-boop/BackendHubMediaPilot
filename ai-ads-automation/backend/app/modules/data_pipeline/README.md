# Data Pipeline Module

## Overview
The Data Pipeline module provides services for data ingestion, processing, validation, and storage. It is designed to handle data from various sources and ensure data quality and integrity.

## Features
- **Data Ingestion**: Collect data from various sources (ad platforms, CRM, analytics).
- **Data Processing**: Transform and enrich data for analysis and optimization.
- **Data Validation**: Ensure data quality and integrity through validation rules.
- **Data Storage**: Store processed data in appropriate database tables.
- **Data Retrieval**: Retrieve stored data with filtering and pagination.

## Architecture
- `service.py`: Main service orchestrating all data pipeline functionality.
- `ingestion.py`: Service for data ingestion from various sources.
- `processing.py`: Service for data processing and transformation.
- `validation.py`: Service for data validation and quality checks.
- `storage.py`: Service for data storage and retrieval.
- `api.py`: FastAPI routes for data pipeline services.
- `schemas/data_pipeline.py`: Pydantic models for request and response validation.

## Setup and Configuration
This module primarily relies on the database for data storage and retrieval. No specific environment variables are unique to this module beyond the general database configuration.

## API Endpoints

### `POST /api/v1/data_pipeline/ingest`
Ingest data from various sources.

- **Request Body (`DataIngestionRequest`):**
    ```json
    {
        "source": "meta_ads",
        "data_type": "campaign_performance",
        "data": {
            "records": [
                {
                    "campaign_id": "123",
                    "spend": 100.0,
                    "impressions": 1000,
                    "clicks": 50,
                    "conversions": 5
                }
            ]
        }
    }
    ```
- **Response Body (`DataIngestionResponse`):**
    ```json
    {
        "success": true,
        "source": "meta_ads",
        "data_type": "campaign_performance",
        "result": {
            "ingested_at": "2023-10-27T10:00:00Z",
            "records_count": 1,
            "status": "success"
        }
    }
    ```

### `POST /api/v1/data_pipeline/process`
Process ingested data.

- **Request Body (`DataProcessingRequest`):**
    ```json
    {
        "data_type": "campaign_performance",
        "data": {
            "records": [
                {
                    "campaign_id": "123",
                    "spend": 100.0,
                    "impressions": 1000,
                    "clicks": 50,
                    "conversions": 5
                }
            ]
        },
        "processing_options": {
            "calculate_metrics": true,
            "enrich_with_audience_data": true
        }
    }
    ```
- **Response Body (`DataProcessingResponse`):**
    ```json
    {
        "success": true,
        "data_type": "campaign_performance",
        "result": {
            "processed_at": "2023-10-27T10:00:00Z",
            "records_count": 1,
            "status": "success"
        }
    }
    ```

### `POST /api/v1/data_pipeline/validate`
Validate data quality and integrity.

- **Request Body (`DataValidationRequest`):**
    ```json
    {
        "data_type": "campaign_performance",
        "data": {
            "records": [
                {
                    "campaign_id": "123",
                    "spend": 100.0,
                    "impressions": 1000,
                    "clicks": 50,
                    "conversions": 5
                }
            ]
        },
        "validation_rules": {
            "required_fields": ["campaign_id", "spend", "impressions", "clicks", "conversions"],
            "numeric_fields": ["spend", "impressions", "clicks", "conversions"]
        }
    }
    ```
- **Response Body (`DataValidationResponse`):**
    ```json
    {
        "success": true,
        "data_type": "campaign_performance",
        "result": {
            "validated_at": "2023-10-27T10:00:00Z",
            "validation_passed": true,
            "issues_found": 0,
            "status": "success"
        }
    }
    ```

### `POST /api/v1/data_pipeline/store`
Store processed data.

- **Request Body (`DataStorageRequest`):**
    ```json
    {
        "data_type": "campaign_performance",
        "data": {
            "records": [
                {
                    "campaign_id": "123",
                    "spend": 100.0,
                    "impressions": 1000,
                    "clicks": 50,
                    "conversions": 5
                }
            ]
        },
        "storage_options": {
            "table_name": "campaign_performance",
            "upsert": true
        }
    }
    ```
- **Response Body (`DataStorageResponse`):**
    ```json
    {
        "success": true,
        "data_type": "campaign_performance",
        "result": {
            "stored_at": "2023-10-27T10:00:00Z",
            "records_count": 1,
            "status": "success"
        }
    }
    ```

### `POST /api/v1/data_pipeline/retrieve`
Retrieve stored data.

- **Request Body (`DataRetrievalRequest`):**
    ```json
    {
        "data_type": "campaign_performance",
        "filters": {
            "campaign_id": "123",
            "date_range": {
                "start": "2023-10-01",
                "end": "2023-10-31"
            }
        },
        "limit": 100,
        "offset": 0
    }
    ```
- **Response Body (`DataRetrievalResponse`):**
    ```json
    {
        "success": true,
        "data_type": "campaign_performance",
        "result": {
            "retrieved_at": "2023-10-27T10:00:00Z",
            "records_count": 0,
            "status": "success"
        }
    }
    ```

## How to Extend / Integrate
- **Enhance Data Ingestion**: Improve `ingestion.py` by integrating with more data sources and implementing real-time data collection.
- **Implement Advanced Processing**: Enhance `processing.py` with more sophisticated data transformation and enrichment logic.
- **Add More Validation Rules**: Extend `validation.py` to include more comprehensive data quality checks.
- **Optimize Storage**: Improve `storage.py` with better indexing, partitioning, and query optimization strategies.



