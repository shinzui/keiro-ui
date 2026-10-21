import type { AddressInfo } from "node:net"

import { WebSocketServer, type WebSocket as ServerSocket } from "ws"

/** A WebSocket server on an ephemeral port whose per-connection behaviour a test scripts. */
export async function scriptedServer(
  onConnection: (socket: ServerSocket, received: string[], index: number) => void,
) {
  const server = new WebSocketServer({ port: 0, host: "127.0.0.1" })
  await new Promise<void>((resolve) => server.once("listening", () => resolve()))
  const received: string[] = []
  let connections = 0
  server.on("connection", (socket) => {
    const index = connections
    connections += 1
    socket.on("message", (data) => received.push(String(data)))
    onConnection(socket, received, index)
  })
  const { port } = server.address() as AddressInfo
  return {
    url: `ws://127.0.0.1:${port}/ws`,
    received,
    connections: () => connections,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  }
}
