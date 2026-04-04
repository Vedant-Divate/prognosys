// frontend/src/hooks/useWebSocket.js
import { useState, useEffect, useRef, useCallback } from 'react';

const DEFAULT_STATE = {
  machine_id: "CNC-01",
  timestamp: "",
  vibration_rms: 2.0,
  spindle_load: 65.0,
  temperature_c: 67.0,
  tool_life_pct: 100.0,
  health_score: 100.0,
  rul_hours: 168.0,
  is_anomaly: false,
  anomaly_flags: [],
  subsystem_states: {
    spindle: "green",
    bearing: "green",
    coolant: "green",
    tool: "green",
  },
  deterioration_trajectory: [],
};

export const useWebSocket = (url) => {
  const [state, setState] = useState(DEFAULT_STATE);
  const [status, setStatus] = useState("disconnected");
  const ws = useRef(null);
  const reconnectTimeout = useRef(1000);
  const isMounted = useRef(true);

  const connect = useCallback(() => {
    if (!isMounted.current) return;

    setStatus("connecting");

    try {
      ws.current = new WebSocket(url);
    } catch (err) {
      console.error("[WS] Failed to construct WebSocket:", err);
      setStatus("disconnected");
      return;
    }

    ws.current.onopen = () => {
      if (!isMounted.current) return;
      console.log("[WS] Connected to", url);
      setStatus("connected");
      reconnectTimeout.current = 1000; // reset backoff on success
    };

    ws.current.onmessage = (event) => {
      if (!isMounted.current) return;
      try {
        const data = JSON.parse(event.data);
        setState(data);
      } catch (err) {
        console.error("[WS] Failed to parse message:", err);
      }
    };

    ws.current.onerror = (err) => {
      console.warn("[WS] Error:", err);
      // onclose will fire after onerror — reconnect logic lives there
    };

    ws.current.onclose = (event) => {
      if (!isMounted.current) return;
      console.warn(`[WS] Closed (code ${event.code}). Reconnecting in ${reconnectTimeout.current}ms...`);
      setStatus("reconnecting");

      const delay = reconnectTimeout.current;
      // Exponential backoff: 1s → 2s → 4s → 8s → 16s → 30s max
      reconnectTimeout.current = Math.min(reconnectTimeout.current * 2, 30000);

      setTimeout(() => {
        if (isMounted.current) connect();
      }, delay);
    };
  }, [url]);

  useEffect(() => {
    isMounted.current = true;
    connect();

    return () => {
      isMounted.current = false;
      if (ws.current) {
        // Close without triggering reconnect
        ws.current.onclose = null;
        ws.current.close();
      }
    };
  }, [connect]);

  const reconnect = useCallback(() => {
    reconnectTimeout.current = 1000; // reset backoff on manual reconnect
    if (ws.current) {
      ws.current.onclose = null;
      ws.current.close();
    }
    connect();
  }, [connect]);

  return { state, status, reconnect };
};