// server.ts

import dotenv from 'dotenv';
dotenv.config({ path: '.env' }); // 반드시 최상단
import express from 'express';
import cors from 'cors';
import http from 'http';
import logger from 'morgan';
import wrtc from 'wrtc';
import socketio from 'socket.io';

const app = express();
const PORT = 3001;

app.use(logger('dev'));
app.use(express.json());
app.use(
  cors({
    origin: 'http://localhost:3000',
    credentials: true,
  })
);

const server = http.createServer(app);
const io = new socketio(server, {
  cors: {
    origin: 'http://localhost:3000',
    credentials: true,
  },
});

server.listen(PORT, () => {
  console.log(`🚀 서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
});

const pc_config = {
  iceServers: [
    {
      urls: 'stun:stun.l.google.com:19302',
    },
  ],
};

let receiverPCs = {};
let senderPCs = {};
let users = {};
let socketToRoom = {};

const isIncluded = (array, id) => array.some((item) => item.id === id);

const createReceiverPeerConnection = (socketID, socket, roomID) => {
  const pc = new wrtc.RTCPeerConnection(pc_config);

  receiverPCs = { ...receiverPCs, [socketID]: pc };

  pc.onicecandidate = (e) => {
    socket.to(socketID).emit('getSenderCandidate', {
      candidate: e.candidate,
    });
  };

  pc.ontrack = (e) => {
    if (!users[roomID]) {
      users[roomID] = [];
    }
    if (!isIncluded(users[roomID], socketID)) {
      users[roomID].push({ id: socketID, stream: e.streams[0] });
      socket.broadcast.to(roomID).emit('userEnter', { id: socketID });
    }
  };

  return pc;
};

const createSenderPeerConnection = (receiverSocketID, senderSocketID, socket, roomID) => {
  const pc = new wrtc.RTCPeerConnection(pc_config);

  if (!senderPCs[senderSocketID]) {
    senderPCs[senderSocketID] = [];
  }
  senderPCs[senderSocketID].push({ id: receiverSocketID, pc });

  pc.onicecandidate = (e) => {
    socket.to(receiverSocketID).emit('getReceiverCandidate', {
      id: senderSocketID,
      candidate: e.candidate,
    });
  };

  const sendUser = users[roomID]?.find((user) => user.id === senderSocketID);
  sendUser?.stream.getTracks().forEach((track) => {
    pc.addTrack(track, sendUser.stream);
  });

  return pc;
};

const getOtherUsersInRoom = (socketID, roomID) => {
  return (
    users[roomID]?.filter((user) => user.id !== socketID).map((user) => ({ id: user.id })) || []
  );
};

const deleteUser = (socketID, roomID) => {
  users[roomID] = users[roomID]?.filter((user) => user.id !== socketID) || [];
  if (users[roomID]?.length === 0) {
    delete users[roomID];
  }
  delete socketToRoom[socketID];
};

const closeReceiverPC = (socketID) => {
  receiverPCs[socketID]?.close();
  delete receiverPCs[socketID];
};

const closeSenderPCs = (socketID) => {
  senderPCs[socketID]?.forEach((senderPC) => {
    senderPC.pc.close();
    const targetList = senderPCs[senderPC.id];
    senderPCs[senderPC.id] = targetList?.filter((sPC) => sPC.id !== socketID) || [];
  });
  delete senderPCs[socketID];
};

io.on('connection', (socket) => {
  console.log('✅ 클라이언트 연결됨:', socket.id);

  socket.on('joinRoom', (data) => {
    const allUsers = getOtherUsersInRoom(data.id, data.roomID);
    io.to(data.id).emit('allUsers', { users: allUsers });
  });

  socket.on('senderOffer', async (data) => {
    socketToRoom[data.senderSocketID] = data.roomID;
    const pc = createReceiverPeerConnection(data.senderSocketID, socket, data.roomID);
    await pc.setRemoteDescription(data.sdp);
    const sdp = await pc.createAnswer();
    await pc.setLocalDescription(sdp);
    socket.join(data.roomID);
    io.to(data.senderSocketID).emit('getSenderAnswer', { sdp });
  });

  socket.on('senderCandidate', async (data) => {
    const pc = receiverPCs[data.senderSocketID];
    await pc?.addIceCandidate(new wrtc.RTCIceCandidate(data.candidate));
  });

  socket.on('receiverOffer', async (data) => {
    const pc = createSenderPeerConnection(
      data.receiverSocketID,
      data.senderSocketID,
      socket,
      data.roomID
    );
    await pc.setRemoteDescription(data.sdp);
    const sdp = await pc.createAnswer();
    await pc.setLocalDescription(sdp);
    io.to(data.receiverSocketID).emit('getReceiverAnswer', {
      id: data.senderSocketID,
      sdp,
    });
  });

  socket.on('receiverCandidate', async (data) => {
    const senderPC = senderPCs[data.senderSocketID]?.find(
      (sPC) => sPC.id === data.receiverSocketID
    );
    await senderPC?.pc.addIceCandidate(new wrtc.RTCIceCandidate(data.candidate));
  });

  socket.on('disconnect', () => {
    const roomID = socketToRoom[socket.id];
    deleteUser(socket.id, roomID);
    closeReceiverPC(socket.id);
    closeSenderPCs(socket.id);
    socket.broadcast.to(roomID).emit('userExit', { id: socket.id });
  });
});
