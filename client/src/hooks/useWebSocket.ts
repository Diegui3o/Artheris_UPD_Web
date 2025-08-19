import { useState, useEffect, useCallback, useRef } from 'react';

type MessageType = 'LED_STATE' | 'LED_CONTROL' | 'ERROR' | 'CONNECTION_STATUS' | string;

type WebSocketMessage<T = unknown> = {
  type: MessageType;
  payload: T;
  timestamp: number;
};

type MessageHandler<T = unknown> = (data: T) => void;

interface UseWebSocketReturn {
  isConnected: boolean;
  sendMessage: <T>(type: MessageType, payload?: T) => boolean;
  onMessage: <T>(type: MessageType, handler: MessageHandler<T>) => () => void;
}

const useWebSocket = (url: string): UseWebSocketReturn => {
  const [isConnected, setIsConnected] = useState(false);
  type MessageHandlerFunction = (payload: unknown) => void;
  const messageHandlersRef = useRef<Map<MessageType, Set<MessageHandlerFunction>>>(new Map());
  const reconnectAttempts = useRef(0);
  const socketRef = useRef<WebSocket | null>(null);

  const MAX_RECONNECT_ATTEMPTS = 5;
  const INITIAL_RECONNECT_DELAY = 1000; // 1 segundo

  // Función para enviar mensajes
  const sendMessage = useCallback(
    <T = Record<string, unknown>>(type: MessageType, payload?: T): boolean => {
      const socket = socketRef.current;
      if (socket && socket.readyState === WebSocket.OPEN) {
        const message = { 
          type, 
          ...(payload ? { payload } : {}), 
          timestamp: Date.now() 
        };
        socket.send(JSON.stringify(message));
        return true;
      }
      console.warn("WebSocket no está conectado");
      return false;
    },
    []
  );

  // Registrar manejadores de mensajes
  const onMessage = useCallback(
    <T = unknown>(type: MessageType, handler: (data: T) => void) => {
      if (!messageHandlersRef.current.has(type)) {
        messageHandlersRef.current.set(type, new Set());
      }
      const handlers = messageHandlersRef.current.get(type)!;
      
      const handlerWrapper = (data: unknown) => {
        try {
          // If data is a WebSocketMessage with payload, extract the payload
          const messageData = data && typeof data === 'object' && 'payload' in data 
            ? (data as { payload: unknown }).payload 
            : data;
          
          handler(messageData as T);
        } catch (error) {
          console.error('Error in message handler:', error);
        }
      };
      
      handlers.add(handlerWrapper);

      // Cleanup function
      return () => {
        handlers.delete(handlerWrapper);
        if (handlers.size === 0) {
          messageHandlersRef.current.delete(type);
        }
      };
    },
    []
  );

  useEffect(() => {
    let reconnectTimeout: NodeJS.Timeout;

    const connect = () => {
      if (reconnectAttempts.current >= MAX_RECONNECT_ATTEMPTS) {
        console.error('Máximo número de intentos de reconexión alcanzado');
        return;
      }

      const ws = new WebSocket(url);
      
      ws.onopen = () => {
        console.log('WebSocket conectado');
        reconnectAttempts.current = 0;
        setIsConnected(true);
      };
      
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (!message || typeof message !== 'object') return;
          
          const { type } = message as { type?: MessageType };
          if (!type) return;
      
          // Handle typed handlers
          const handlers = messageHandlersRef.current.get(type);
          if (handlers) {
            const messageData = 'payload' in message ? message.payload : message;
            handlers.forEach((handler) => {
              try {
                handler(messageData);
              } catch (err) {
                console.error(`Error en handler para ${type}:`, err);
              }
            });
          }
      
          // Handle wildcard handlers
          const anyHandlers = messageHandlersRef.current.get("*" as MessageType);
          if (anyHandlers) {
            anyHandlers.forEach((handler) => {
              try {
                handler(message);
              } catch (err) {
                console.error('Error en handler *:', err);
              }
            });
          }
        } catch (error) {
          console.error("Error procesando mensaje:", error, event.data);
        }
      };
      
      ws.onclose = () => {
        console.log('WebSocket desconectado');
        setIsConnected(false);
        
        // Reconexión con retroceso exponencial
        if (reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
          const delay = Math.min(
            INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttempts.current),
            30000 // Máximo 30 segundos
          );
          
          console.log(`Intentando reconectar en ${delay}ms...`);
          reconnectTimeout = setTimeout(() => {
            reconnectAttempts.current += 1;
            connect();
          }, delay);
        }
      };
      
      ws.onerror = (error) => {
        console.error('Error en WebSocket:', error);
        ws.close();
      };
      
      socketRef.current = ws;
    };

    connect();

    return () => {
      clearTimeout(reconnectTimeout);
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [url]);

  return {
    isConnected,
    sendMessage,
    onMessage,
  };
};

export { useWebSocket };
export type { WebSocketMessage, MessageType };
