from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any

import requests


@dataclass
class ApiResponse:
    status_code: int
    data: Any


def fetch_external_feed(endpoint: str, api_key_env: str = "FARSI_API_KEY") -> ApiResponse:
    api_key = os.getenv(api_key_env, "")
    headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}
    response = requests.get(endpoint, headers=headers, timeout=30)
    try:
        data = response.json()
    except ValueError:
        data = response.text
    return ApiResponse(status_code=response.status_code, data=data)
