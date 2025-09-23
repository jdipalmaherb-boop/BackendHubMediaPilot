"""
Pydantic schemas for data pipeline services.
"""

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class DataIngestionRequest(BaseModel):
    """Request schema for data ingestion."""
    
    source: str = Field(..., description="Source of the data (e.g., 'meta_ads', 'google_ads', 'tiktok_ads')")
    data_type: str = Field(..., description="Type of data being ingested (e.g., 'campaign_performance', 'audience_data')")
    data: Dict[str, Any] = Field(..., description="Data to be ingested")


class DataIngestionResponse(BaseModel):
    """Response schema for data ingestion."""
    
    success: bool = Field(..., description="Whether the request was successful")
    source: str = Field(..., description="Source of the data")
    data_type: str = Field(..., description="Type of data ingested")
    result: Dict[str, Any] = Field(..., description="Result of the ingestion process")


class DataProcessingRequest(BaseModel):
    """Request schema for data processing."""
    
    data_type: str = Field(..., description="Type of data being processed")
    data: Dict[str, Any] = Field(..., description="Data to be processed")
    processing_options: Optional[Dict[str, Any]] = Field(None, description="Options for data processing")


class DataProcessingResponse(BaseModel):
    """Response schema for data processing."""
    
    success: bool = Field(..., description="Whether the request was successful")
    data_type: str = Field(..., description="Type of data processed")
    result: Dict[str, Any] = Field(..., description="Result of the processing")


class DataValidationRequest(BaseModel):
    """Request schema for data validation."""
    
    data_type: str = Field(..., description="Type of data being validated")
    data: Dict[str, Any] = Field(..., description="Data to be validated")
    validation_rules: Optional[Dict[str, Any]] = Field(None, description="Rules for data validation")


class DataValidationResponse(BaseModel):
    """Response schema for data validation."""
    
    success: bool = Field(..., description="Whether the request was successful")
    data_type: str = Field(..., description="Type of data validated")
    result: Dict[str, Any] = Field(..., description="Result of the validation")


class DataStorageRequest(BaseModel):
    """Request schema for data storage."""
    
    data_type: str = Field(..., description="Type of data being stored")
    data: Dict[str, Any] = Field(..., description="Data to be stored")
    storage_options: Optional[Dict[str, Any]] = Field(None, description="Options for data storage")


class DataStorageResponse(BaseModel):
    """Response schema for data storage."""
    
    success: bool = Field(..., description="Whether the request was successful")
    data_type: str = Field(..., description="Type of data stored")
    result: Dict[str, Any] = Field(..., description="Result of the storage")


class DataRetrievalRequest(BaseModel):
    """Request schema for data retrieval."""
    
    data_type: str = Field(..., description="Type of data to retrieve")
    filters: Optional[Dict[str, Any]] = Field(None, description="Filters to apply when retrieving data")
    limit: Optional[int] = Field(None, description="Maximum number of records to retrieve")
    offset: Optional[int] = Field(None, description="Number of records to skip")


class DataRetrievalResponse(BaseModel):
    """Response schema for data retrieval."""
    
    success: bool = Field(..., description="Whether the request was successful")
    data_type: str = Field(..., description="Type of data retrieved")
    result: Dict[str, Any] = Field(..., description="Result of the retrieval")



