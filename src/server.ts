import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import app from './app';
import { createSocketServer } from './socket';

const PORT = Number(process.env.PORT) || 3001;

const server = http.createServer(app);
createSocketServer(server);

server.listen(PORT, () => {
  console.log(`🚀 서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
});
