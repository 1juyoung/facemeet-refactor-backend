// server.ts

import dotenv from 'dotenv';
dotenv.config({ path: '.env' }); // 반드시 최상단

import express from 'express';
import cors from 'cors';
import http from 'http';
import logger from 'morgan';

import socketHandler from '../socket/socketHandler';
import db from '../mysql/db';

const app = express();
const PORT = 3001;

const server = http.createServer(app);

async function startServer() {
  try {
    await db.query('SELECT 1');
    console.log('✅ MySQL 연결 성공');

    socketHandler(server);

    app.use(logger('dev'));
    app.use(express.json());
    app.use(cors());

    app.get('/', (req, res) => {
      res.send('Backend API is running!');
    });

    server.listen(PORT, () => {
      console.log(`🚀 서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
    });
  } catch (err) {
    console.error('❌ MySQL 연결 실패:', err);
    process.exit(1);
  }
}

startServer();
