# backend/routers/fmea_router.py
from fastapi import APIRouter, HTTPException
from typing import List

from backend.models.schemas import FMEAResponse, RootCauseModel, CorrectiveActionModel
from backend.services.fmea_service import query_fmea, get_all_failure_modes

router = APIRouter()


@router.get("/api/fmea/{anomaly_flag}", response_model=FMEAResponse)
async def get_fmea_analysis(anomaly_flag: str):
    """
    Given an anomaly flag (e.g. 'bearing_wear'), traverses the FMEA
    knowledge graph and returns root causes and corrective actions.
    Called automatically by the frontend when anomaly_flags is non-empty.
    """
    result = query_fmea(anomaly_flag)

    if result is None:
        raise HTTPException(
            status_code=404,
            detail=f"No FMEA data found for anomaly flag: '{anomaly_flag}'. "
                   f"Valid flags: {get_all_failure_modes()}"
        )

    return FMEAResponse(
        failure_mode       = result["failure_mode"],
        severity           = result["severity"],
        affected_subsystem = result["affected_subsystem"],
        root_causes        = [RootCauseModel(**rc) for rc in result["root_causes"]],
        corrective_actions = [CorrectiveActionModel(**ca) for ca in result["corrective_actions"]]
    )


@router.get("/api/fmea")
async def list_failure_modes():
    """
    Returns all registered failure mode names.
    Useful for the frontend to know which flags are queryable.
    """
    return {"failure_modes": get_all_failure_modes()}