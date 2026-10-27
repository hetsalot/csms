import React, { createContext, useContext, useEffect, useState, useRef } from 'react';

const WebSocketContext = createContext();

export const WebSocketProvider = ({ children }) => {
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const wsRef = useRef(null);
  const listenersRef = useRef(new Set());

  useEffect(() => {
    let ws;
    let reconnectTimeout;

    function connect() {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;

      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          setLastEvent(parsed);

          // Add to notification list if appropriate
          if (['NEW_BOOKING', 'CHARGER_FAULT_ALERT', 'OPERATOR_NOTIFICATION', 'BOOKING_CANCELED', 'CHARGING_COMPLETED'].includes(parsed.type)) {
            const newNotif = {
              id: Date.now() + Math.random(),
              type: parsed.type,
              data: parsed.data,
              timestamp: parsed.timestamp || new Date().toISOString()
            };
            setNotifications(prev => [newNotif, ...prev.slice(0, 49)]);
          }

          // Trigger all registered listeners
          for (const listener of listenersRef.current) {
            listener(parsed);
          }
        } catch (e) {
          console.error('WS message parse error:', e);
        }
      };

      ws.onclose = () => {
        setConnected(false);
        reconnectTimeout = setTimeout(connect, 3000);
      };

      ws.onerror = (err) => {
        setConnected(false);
      };
    }

    connect();

    return () => {
      clearTimeout(reconnectTimeout);
      if (ws) ws.close();
    };
  }, []);

  const addEventListener = (callback) => {
    listenersRef.current.add(callback);
    return () => listenersRef.current.delete(callback);
  };

  const clearNotifications = () => setNotifications([]);

  return (
    <WebSocketContext.Provider value={{ connected, lastEvent, notifications, addEventListener, clearNotifications }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => useContext(WebSocketContext);
