"""
GoHighLevel OAuth integration for CRM functionality.
"""

import os
import secrets
import hashlib
import base64
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
from urllib.parse import urlencode, parse_qs

import requests
from fastapi import APIRouter, HTTPException, status, Depends, Request
from fastapi.responses import RedirectResponse

from app.core.logging import logger
from app.core.config import settings


class GoHighLevelOAuth:
    """GoHighLevel OAuth integration handler."""

    def __init__(self):
        self.client_id = os.getenv("GHL_CLIENT_ID")
        self.client_secret = os.getenv("GHL_CLIENT_SECRET")
        self.redirect_uri = os.getenv("GHL_OAUTH_REDIRECT")
        self.base_url = "https://api.gohighlevel.com"
        self.auth_url = "https://app.gohighlevel.com/oauth/authorize"
        self.token_url = "https://api.gohighlevel.com/oauth/token"
        
        # Validate required environment variables
        if not all([self.client_id, self.client_secret, self.redirect_uri]):
            logger.warning("GoHighLevel OAuth credentials not fully configured")
        
        logger.info("GoHighLevel OAuth handler initialized")

    def generate_auth_url(self, state: Optional[str] = None) -> Dict[str, Any]:
        """
        Generate OAuth authorization URL for GoHighLevel.
        
        Args:
            state: Optional state parameter for CSRF protection
            
        Returns:
            Dict containing authorization URL and state
        """
        if not self.client_id or not self.redirect_uri:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="GoHighLevel OAuth not properly configured"
            )
        
        # Generate state if not provided
        if not state:
            state = self._generate_state()
        
        # Define OAuth scopes
        scopes = [
            "contacts",
            "appointments",
            "campaigns",
            "conversations",
            "locations",
            "opportunities",
            "pipelines",
            "products",
            "tasks",
            "users"
        ]
        
        # Build authorization URL
        params = {
            "response_type": "code",
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "scope": " ".join(scopes),
            "state": state,
            "access_type": "offline"
        }
        
        auth_url = f"{self.auth_url}?{urlencode(params)}"
        
        logger.info(f"Generated GoHighLevel auth URL for state: {state}")
        
        return {
            "url": auth_url,
            "state": state,
            "scopes": scopes
        }

    def exchange_code_for_token(
        self, 
        code: str, 
        state: str,
        stored_state: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Exchange authorization code for access token.
        
        Args:
            code: Authorization code from callback
            state: State parameter from callback
            stored_state: Previously stored state for validation
            
        Returns:
            Dict containing token data and connection status
        """
        if not all([self.client_id, self.client_secret, self.redirect_uri]):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="GoHighLevel OAuth not properly configured"
            )
        
        # Validate state parameter
        if stored_state and state != stored_state:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid state parameter"
            )
        
        # Prepare token request
        token_data = {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": self.redirect_uri,
            "client_id": self.client_id,
            "client_secret": self.client_secret
        }
        
        try:
            # Make token request
            response = requests.post(
                self.token_url,
                data=token_data,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                timeout=30
            )
            
            if response.status_code != 200:
                logger.error(f"Token exchange failed: {response.status_code} - {response.text}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Token exchange failed: {response.text}"
                )
            
            token_data = response.json()
            
            # Validate token response
            if "access_token" not in token_data:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid token response from GoHighLevel"
                )
            
            # Add metadata
            token_data["expires_at"] = datetime.utcnow() + timedelta(seconds=token_data.get("expires_in", 3600))
            token_data["connected_at"] = datetime.utcnow().isoformat()
            token_data["state"] = state
            
            logger.info("Successfully exchanged code for GoHighLevel token")
            
            return {
                "status": "connected",
                "data": token_data,
                "expires_at": token_data["expires_at"].isoformat(),
                "scopes": token_data.get("scope", "").split()
            }
            
        except requests.RequestException as e:
            logger.error(f"Request error during token exchange: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to exchange code for token: {e}"
            )
        except Exception as e:
            logger.error(f"Unexpected error during token exchange: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Token exchange failed: {e}"
            )

    def refresh_access_token(self, refresh_token: str) -> Dict[str, Any]:
        """
        Refresh access token using refresh token.
        
        Args:
            refresh_token: Refresh token from previous authorization
            
        Returns:
            Dict containing new token data
        """
        if not self.client_secret:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="GoHighLevel OAuth not properly configured"
            )
        
        refresh_data = {
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
            "client_id": self.client_id,
            "client_secret": self.client_secret
        }
        
        try:
            response = requests.post(
                self.token_url,
                data=refresh_data,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                timeout=30
            )
            
            if response.status_code != 200:
                logger.error(f"Token refresh failed: {response.status_code} - {response.text}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Token refresh failed: {response.text}"
                )
            
            token_data = response.json()
            token_data["expires_at"] = datetime.utcnow() + timedelta(seconds=token_data.get("expires_in", 3600))
            token_data["refreshed_at"] = datetime.utcnow().isoformat()
            
            logger.info("Successfully refreshed GoHighLevel token")
            
            return {
                "status": "refreshed",
                "data": token_data,
                "expires_at": token_data["expires_at"].isoformat()
            }
            
        except requests.RequestException as e:
            logger.error(f"Request error during token refresh: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to refresh token: {e}"
            )

    def revoke_token(self, token: str) -> Dict[str, Any]:
        """
        Revoke access token.
        
        Args:
            token: Access token to revoke
            
        Returns:
            Dict containing revocation status
        """
        revoke_url = f"{self.base_url}/oauth/revoke"
        
        try:
            response = requests.post(
                revoke_url,
                data={"token": token},
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                timeout=30
            )
            
            if response.status_code in [200, 204]:
                logger.info("Successfully revoked GoHighLevel token")
                return {"status": "revoked", "message": "Token revoked successfully"}
            else:
                logger.warning(f"Token revocation returned status {response.status_code}")
                return {"status": "error", "message": "Token revocation failed"}
                
        except requests.RequestException as e:
            logger.error(f"Request error during token revocation: {e}")
            return {"status": "error", "message": f"Failed to revoke token: {e}"}

    def _generate_state(self) -> str:
        """Generate secure state parameter for CSRF protection."""
        # Generate random bytes and encode as base64
        random_bytes = secrets.token_bytes(32)
        state = base64.urlsafe_b64encode(random_bytes).decode('utf-8')
        return state

    def validate_token(self, token: str) -> Dict[str, Any]:
        """
        Validate access token by making a test API call.
        
        Args:
            token: Access token to validate
            
        Returns:
            Dict containing validation result
        """
        try:
            # Make a simple API call to validate token
            response = requests.get(
                f"{self.base_url}/v1/users/me",
                headers={"Authorization": f"Bearer {token}"},
                timeout=30
            )
            
            if response.status_code == 200:
                user_data = response.json()
                return {
                    "valid": True,
                    "user": user_data,
                    "message": "Token is valid"
                }
            else:
                return {
                    "valid": False,
                    "message": f"Token validation failed: {response.status_code}"
                }
                
        except requests.RequestException as e:
            logger.error(f"Request error during token validation: {e}")
            return {
                "valid": False,
                "message": f"Token validation failed: {e}"
            }


# Global OAuth handler instance
ghl_oauth = GoHighLevelOAuth()


def get_ghl_oauth() -> GoHighLevelOAuth:
    """Dependency to get GoHighLevel OAuth handler."""
    return ghl_oauth



