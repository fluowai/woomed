declare module "ws" {
  import type { IncomingMessage, Server as HttpServer } from "http";

  export class WebSocket {
    static OPEN: number;
    readyState: number;
    send(data: string): void;
    close(code?: number, reason?: string): void;
    on(event: "close" | "error", listener: (...args: unknown[]) => void): this;
  }

  export class WebSocketServer {
    constructor(options: { server: HttpServer; path?: string });
    on(event: "connection", listener: (socket: WebSocket, request: IncomingMessage) => void): this;
  }
}
