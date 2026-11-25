import { Server, Socket } from 'socket.io';
// @ts-ignore – @roamhq/wrtc provides WebRTC APIs for Node.js
import wrtc from '@roamhq/wrtc';

const pc_config = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

interface StreamEntry {
  id: string;
  stream: MediaStream;
}

const receiverPCs: Record<string, RTCPeerConnection> = {};
const senderPCs: Record<string, Array<{ id: string; pc: RTCPeerConnection }>> = {};
const users: Record<string, StreamEntry[]> = {};
const socketToRoom: Record<string, string> = {};

function isIncluded(array: StreamEntry[], id: string): boolean {
  return array.some((item) => item.id === id);
}

function createReceiverPC(socketId: string, socket: Socket, roomId: string): RTCPeerConnection {
  const pc: RTCPeerConnection = new wrtc.RTCPeerConnection(pc_config);
  receiverPCs[socketId] = pc;

  pc.onicecandidate = (e: RTCPeerConnectionIceEvent) => {
    socket.to(socketId).emit('getSenderCandidate', { candidate: e.candidate });
  };

  (pc as any).ontrack = (e: RTCTrackEvent) => {
    if (!users[roomId]) users[roomId] = [];
    if (!isIncluded(users[roomId], socketId)) {
      users[roomId].push({ id: socketId, stream: e.streams[0] });
      socket.broadcast.to(roomId).emit('userEnter', { id: socketId });
    }
  };

  return pc;
}

function createSenderPC(
  receiverSocketId: string,
  senderSocketId: string,
  socket: Socket,
  roomId: string
): RTCPeerConnection {
  const pc: RTCPeerConnection = new wrtc.RTCPeerConnection(pc_config);

  if (!senderPCs[senderSocketId]) senderPCs[senderSocketId] = [];
  senderPCs[senderSocketId].push({ id: receiverSocketId, pc });

  pc.onicecandidate = (e: RTCPeerConnectionIceEvent) => {
    socket.to(receiverSocketId).emit('getReceiverCandidate', {
      id: senderSocketId,
      candidate: e.candidate,
    });
  };

  const sendUser = users[roomId]?.find((u) => u.id === senderSocketId);
  sendUser?.stream.getTracks().forEach((track) => {
    pc.addTrack(track, sendUser.stream);
  });

  return pc;
}

function getOtherUsers(socketId: string, roomId: string): Array<{ id: string }> {
  return users[roomId]?.filter((u) => u.id !== socketId).map((u) => ({ id: u.id })) ?? [];
}

function deleteUser(socketId: string, roomId: string): void {
  users[roomId] = users[roomId]?.filter((u) => u.id !== socketId) ?? [];
  if (users[roomId]?.length === 0) delete users[roomId];
  delete socketToRoom[socketId];
}

function closeReceiverPC(socketId: string): void {
  receiverPCs[socketId]?.close();
  delete receiverPCs[socketId];
}

function closeSenderPCs(socketId: string): void {
  senderPCs[socketId]?.forEach((entry) => {
    entry.pc.close();
    senderPCs[entry.id] = senderPCs[entry.id]?.filter((p) => p.id !== socketId) ?? [];
  });
  delete senderPCs[socketId];
}

export function registerMeetingSocket(io: Server, socket: Socket): void {
  socket.on('joinRoom', (data: { id: string; roomID: string }) => {
    const allUsers = getOtherUsers(data.id, data.roomID);
    io.to(data.id).emit('allUsers', { users: allUsers });
  });

  socket.on(
    'senderOffer',
    async (data: { senderSocketID: string; roomID: string; sdp: RTCSessionDescriptionInit }) => {
      socketToRoom[data.senderSocketID] = data.roomID;
      const pc = createReceiverPC(data.senderSocketID, socket, data.roomID);
      await pc.setRemoteDescription(new wrtc.RTCSessionDescription(data.sdp));
      const sdp = await pc.createAnswer();
      await pc.setLocalDescription(sdp);
      socket.join(data.roomID);
      io.to(data.senderSocketID).emit('getSenderAnswer', { sdp });
    }
  );

  socket.on(
    'senderCandidate',
    async (data: { senderSocketID: string; candidate: RTCIceCandidateInit }) => {
      const pc = receiverPCs[data.senderSocketID];
      if (pc && data.candidate) {
        await pc.addIceCandidate(new wrtc.RTCIceCandidate(data.candidate));
      }
    }
  );

  socket.on(
    'receiverOffer',
    async (data: {
      receiverSocketID: string;
      senderSocketID: string;
      roomID: string;
      sdp: RTCSessionDescriptionInit;
    }) => {
      const pc = createSenderPC(data.receiverSocketID, data.senderSocketID, socket, data.roomID);
      await pc.setRemoteDescription(new wrtc.RTCSessionDescription(data.sdp));
      const sdp = await pc.createAnswer();
      await pc.setLocalDescription(sdp);
      io.to(data.receiverSocketID).emit('getReceiverAnswer', { id: data.senderSocketID, sdp });
    }
  );

  socket.on(
    'receiverCandidate',
    async (data: {
      senderSocketID: string;
      receiverSocketID: string;
      candidate: RTCIceCandidateInit;
    }) => {
      const entry = senderPCs[data.senderSocketID]?.find((p) => p.id === data.receiverSocketID);
      if (entry && data.candidate) {
        await entry.pc.addIceCandidate(new wrtc.RTCIceCandidate(data.candidate));
      }
    }
  );

  socket.on('disconnect', () => {
    const roomId = socketToRoom[socket.id];
    deleteUser(socket.id, roomId);
    closeReceiverPC(socket.id);
    closeSenderPCs(socket.id);
    socket.broadcast.to(roomId).emit('userExit', { id: socket.id });
    console.log(`[Socket] 클라이언트 연결 해제: ${socket.id}`);
  });
}
