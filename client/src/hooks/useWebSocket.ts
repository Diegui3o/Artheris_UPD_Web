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
  const sendMessage = useCallback(<T,>(type: MessageType, payload?: T): boolean => {
    const socket = socketRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      const message: WebSocketMessage<T> = {
        type,
        payload: payload as T,
        timestamp: Date.now(),
      };
      socket.send(JSON.stringify(message));
      return true;
    }
    console.warn('WebSocket no está conectado');
    return false;
  }, []);

  // Registrar manejadores de mensajes
  const onMessage = useCallback(<T,>(
    type: string,
    handler: (data: T) => void
  ) => {
    if (!messageHandlersRef.current.has(type)) {
      messageHandlersRef.current.set(type, new Set());
    }
    const handlers = messageHandlersRef.current.get(type)!;
    
    // Safe type assertion since we know this function will be called with correct types
    const handlerWrapper = (data: unknown) => {
      handler(data as T);
    };
    
    handlers.add(handlerWrapper);

    // Cleanup function
    return () => {
      handlers.delete(handlerWrapper);
      if (handlers.size === 0) {
        messageHandlersRef.current.delete(type);
      }
    };
  }, []);

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
          const message = JSON.parse(event.data) as WebSocketMessage;
          const handlers = messageHandlersRef.current.get(message.type);
          
          if (handlers) {
            handlers.forEach(handler => {
              try {
                // Usamos any aquí para evitar problemas de tipos con el handler genérico
                (handler as (payload: unknown) => void)(message.payload);
              } catch (error) {
                console.error(`Error en el manejador para ${message.type}:`, error);
              }
            });
          }
        } catch (error) {
          console.error('Error procesando mensaje:', error, event.data);
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
