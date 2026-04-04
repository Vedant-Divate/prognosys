# backend/services/fmea_service.py
import networkx as nx
from typing import Optional


# ── Build the FMEA knowledge graph at module load time ───────────────────────
_graph = nx.DiGraph()


def _build_graph():
    """
    Populates the NetworkX directed graph with all 6 failure mode clusters.
    Each cluster has 1 FailureMode, 2 RootCause, and 1 CorrectiveAction node.
    Edges:
      (FailureMode) --HAS_ROOT_CAUSE--> (RootCause)
      (FailureMode) --HAS_ACTION-->     (CorrectiveAction)
    """

    # ── Bearing Wear ──────────────────────────────────────────────────────────
    _graph.add_node("bearing_wear", type="FailureMode",
        description="Progressive degradation of spindle bearing races",
        severity="major", affected_subsystem="bearing")

    _graph.add_node("inadequate_lubrication", type="RootCause",
        description="Grease starvation in bearing housing",
        detection_method="Vibration Analysis")

    _graph.add_node("shaft_misalignment", type="RootCause",
        description="Angular offset in spindle coupling",
        detection_method="Laser Alignment")

    _graph.add_node("replace_bearing", type="CorrectiveAction",
        steps=[
            "Isolate spindle power",
            "Remove bearing housing cover",
            "Extract worn bearing races",
            "Install new bearing assembly",
            "Repack with fresh grease",
            "Verify alignment with dial gauge"
        ],
        urgency="scheduled", downtime_hours=4.5,
        spare_parts=["SKF 6205 Bearing", "Bearing Grease 500g"])

    _graph.add_edge("bearing_wear", "inadequate_lubrication", relation="HAS_ROOT_CAUSE")
    _graph.add_edge("bearing_wear", "shaft_misalignment",     relation="HAS_ROOT_CAUSE")
    _graph.add_edge("bearing_wear", "replace_bearing",        relation="HAS_ACTION")

    # ── Thermal Overload ──────────────────────────────────────────────────────
    _graph.add_node("thermal_overload", type="FailureMode",
        description="Spindle housing temperature exceeds safe operating limits",
        severity="critical", affected_subsystem="coolant")

    _graph.add_node("coolant_pump_failure", type="RootCause",
        description="Mechanical failure of primary coolant pump",
        detection_method="Flow Sensor")

    _graph.add_node("excessive_cutting_parameters", type="RootCause",
        description="Spindle speed/feed rate too high for material",
        detection_method="G-Code Audit")

    _graph.add_node("inspect_coolant_pump", type="CorrectiveAction",
        steps=[
            "Stop machine immediately",
            "Check coolant reservoir level",
            "Inspect pump impeller for damage",
            "Test pump motor current draw",
            "Replace impeller kit if worn",
            "Flush coolant lines",
            "Restart and verify flow rate"
        ],
        urgency="immediate", downtime_hours=1.0,
        spare_parts=["Impeller Kit"])

    _graph.add_edge("thermal_overload", "coolant_pump_failure",         relation="HAS_ROOT_CAUSE")
    _graph.add_edge("thermal_overload", "excessive_cutting_parameters", relation="HAS_ROOT_CAUSE")
    _graph.add_edge("thermal_overload", "inspect_coolant_pump",         relation="HAS_ACTION")

    # ── Tool Worn ─────────────────────────────────────────────────────────────
    _graph.add_node("tool_worn", type="FailureMode",
        description="Flank wear exceeds precision machining threshold",
        severity="minor", affected_subsystem="tool")

    _graph.add_node("exceeded_tool_life_limit", type="RootCause",
        description="Normal wear progression during operation",
        detection_method="Taylor Life Model")

    _graph.add_node("incorrect_feed_rate", type="RootCause",
        description="High feed causing rapid chip-edge wear",
        detection_method="Load Analysis")

    _graph.add_node("tool_change_procedure", type="CorrectiveAction",
        steps=[
            "Halt current machining operation",
            "Retract spindle to tool change position",
            "Release collet and remove worn insert",
            "Install new Carbide Insert CNMG",
            "Verify seating and torque to spec",
            "Run test cut and measure surface finish"
        ],
        urgency="within_8_hours", downtime_hours=0.2,
        spare_parts=["Carbide Insert CNMG"])

    _graph.add_edge("tool_worn", "exceeded_tool_life_limit", relation="HAS_ROOT_CAUSE")
    _graph.add_edge("tool_worn", "incorrect_feed_rate",      relation="HAS_ROOT_CAUSE")
    _graph.add_edge("tool_worn", "tool_change_procedure",    relation="HAS_ACTION")

    # ── Spindle Vibration ─────────────────────────────────────────────────────
    _graph.add_node("spindle_vibration", type="FailureMode",
        description="Excessive rotational oscillation affecting surface finish",
        severity="major", affected_subsystem="spindle")

    _graph.add_node("dynamic_imbalance", type="RootCause",
        description="Unbalanced workpiece or chuck assembly",
        detection_method="Phase Analysis")

    _graph.add_node("loose_foundation_bolts", type="RootCause",
        description="Structural stability compromise",
        detection_method="Visual Inspection")

    _graph.add_node("rebalance_spindle", type="CorrectiveAction",
        steps=[
            "Perform dynamic balance analysis",
            "Attach counterweights to chuck assembly",
            "Verify foundation bolt torque values",
            "Run spindle at operating speed",
            "Confirm vibration within 2.8 mm/s"
        ],
        urgency="scheduled", downtime_hours=6.0,
        spare_parts=["Counterweights"])

    _graph.add_edge("spindle_vibration", "dynamic_imbalance",      relation="HAS_ROOT_CAUSE")
    _graph.add_edge("spindle_vibration", "loose_foundation_bolts", relation="HAS_ROOT_CAUSE")
    _graph.add_edge("spindle_vibration", "rebalance_spindle",      relation="HAS_ACTION")

    # ── Coolant Failure ───────────────────────────────────────────────────────
    _graph.add_node("coolant_failure", type="FailureMode",
        description="Complete loss of fluid delivery to cutting zone",
        severity="critical", affected_subsystem="coolant")

    _graph.add_node("pump_cavitation", type="RootCause",
        description="Air intake in coolant reservoir lines",
        detection_method="Acoustic AE Sensor")

    _graph.add_node("blocked_filter", type="RootCause",
        description="Chip buildup in filtration unit",
        detection_method="Pressure Drop")

    _graph.add_node("flush_coolant_lines", type="CorrectiveAction",
        steps=[
            "Shut down coolant system",
            "Drain and inspect reservoir",
            "Replace filter cartridge",
            "Purge air from supply lines",
            "Refill with fresh coolant mixture",
            "Test flow at all nozzle positions"
        ],
        urgency="immediate", downtime_hours=0.5,
        spare_parts=["Filter Cartridge"])

    _graph.add_edge("coolant_failure", "pump_cavitation",     relation="HAS_ROOT_CAUSE")
    _graph.add_edge("coolant_failure", "blocked_filter",      relation="HAS_ROOT_CAUSE")
    _graph.add_edge("coolant_failure", "flush_coolant_lines", relation="HAS_ACTION")

    # ── Composite Fault ───────────────────────────────────────────────────────
    _graph.add_node("composite_fault", type="FailureMode",
        description="Multi-system cascading degradation",
        severity="critical", affected_subsystem="multi")

    _graph.add_node("structural_resonance", type="RootCause",
        description="Interaction between tool wear and spindle runout",
        detection_method="FFT Spectrum Analysis")

    _graph.add_node("controller_logic_error", type="RootCause",
        description="Invalid servo feedback loop response",
        detection_method="PLC Logs")

    _graph.add_node("full_system_diagnostic", type="CorrectiveAction",
        steps=[
            "Emergency stop and power isolation",
            "Run full axis diagnostic sequence",
            "Inspect all mechanical couplings",
            "Review servo error logs",
            "Replace any flagged electrical components",
            "Full calibration and test run"
        ],
        urgency="immediate", downtime_hours=12.0,
        spare_parts=["Miscellaneous Electrical Components"])

    _graph.add_edge("composite_fault", "structural_resonance",   relation="HAS_ROOT_CAUSE")
    _graph.add_edge("composite_fault", "controller_logic_error", relation="HAS_ROOT_CAUSE")
    _graph.add_edge("composite_fault", "full_system_diagnostic", relation="HAS_ACTION")

    print(f"[fmea_service] Knowledge graph built: "
          f"{_graph.number_of_nodes()} nodes, "
          f"{_graph.number_of_edges()} edges")


# Build graph at import time
_build_graph()


def query_fmea(anomaly_flag: str) -> Optional[dict]:
    """
    Given an anomaly flag string (e.g. 'bearing_wear'), traverses the
    knowledge graph and returns a structured FMEA response dict.
    Returns None if the flag is not found in the graph.
    """
    if anomaly_flag not in _graph.nodes:
        return None

    node_data = _graph.nodes[anomaly_flag]
    if node_data.get("type") != "FailureMode":
        return None

    root_causes        = []
    corrective_actions = []

    for neighbor in _graph.successors(anomaly_flag):
        n_data = _graph.nodes[neighbor]

        if n_data.get("type") == "RootCause":
            root_causes.append({
                "name":             neighbor,
                "description":      n_data.get("description", ""),
                "detection_method": n_data.get("detection_method", "")
            })
        elif n_data.get("type") == "CorrectiveAction":
            corrective_actions.append({
                "name":           neighbor,
                "steps":          n_data.get("steps", []),
                "urgency":        n_data.get("urgency", ""),
                "downtime_hours": n_data.get("downtime_hours", 0.0),
                "spare_parts":    n_data.get("spare_parts", [])
            })

    return {
        "failure_mode":       anomaly_flag,
        "severity":           node_data.get("severity", "unknown"),
        "affected_subsystem": node_data.get("affected_subsystem", "unknown"),
        "root_causes":        root_causes,
        "corrective_actions": corrective_actions
    }


def get_all_failure_modes() -> list:
    """Returns a list of all registered failure mode names."""
    return [
        n for n, d in _graph.nodes(data=True)
        if d.get("type") == "FailureMode"
    ]