import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { registerMeetingSocket } from './meetingSocket';

export function createSocketServer(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    console.log(`[Socket] 클라이언트 연결: ${socket.id}`);
    registerMeetingSocket(io, socket);
  });

  return io;
}
