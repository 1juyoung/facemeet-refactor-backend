import { Server, Socket } from 'socket.io';
// @ts-ignore – @roamhq/wrtc provides WebRTC APIs for Node.js
import wrtc from '@roamhq/wrtc';

import crypto from 'crypto';
import { getServerIceServers } from '../config/ice';

const pc_config = {
  iceServers: getServerIceServers(),
};

interface StreamEntry {
  id: string;
  stream: MediaStream;
}

const receiverPCs: Record<string, RTCPeerConnection> = {};
const senderPCs: Record<string, Array<{ id: string; pc: RTCPeerConnection }>> = {};
const users: Record<string, StreamEntry[]> = {};
const socketToRoom: Record<string, string> = {};
const NICKNAME_LIMIT = 20;
// ---------- 참가자 상태 ----------
// 영상을 보내지 않는 사람(권한 거부)도 참가자로 표시하기 위해 미디어 연결과 별도로 관리한다.
interface ParticipantState {
  id: string;
  nickname: string;
  audio: boolean;
  video: boolean;
}

const participants: Record<string, Record<string, ParticipantState>> = {};

function cleanNickname(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, NICKNAME_LIMIT) : fallback;
}

// ---------- 채팅 ----------
interface ChatMessage {
  id: string;
  senderId: string;
  nickname: string;
  text: string;
  sentAt: string;
}

const CHAT_HISTORY_LIMIT = 100;
const CHAT_TEXT_LIMIT = 500;
// 회의실별 최근 메시지 (서버 메모리). 방이 비면 삭제된다.
const chatHistory: Record<string, ChatMessage[]> = {};

// remoteDescription 설정 전에 도착한 candidate 보관
const pendingCandidates = new WeakMap<RTCPeerConnection, RTCIceCandidateInit[]>();

async function addCandidateSafely(pc: RTCPeerConnection, candidate: RTCIceCandidateInit): Promise<void> {
  if (!pc.remoteDescription) {
    const queue = pendingCandidates.get(pc) ?? [];
    queue.push(candidate);
    pendingCandidates.set(pc, queue);
    return;
  }
  try {
    await pc.addIceCandidate(new wrtc.RTCIceCandidate(candidate));
  } catch (e) {
    console.error('[ICE] candidate 추가 오류:', e);
  }
}

async function flushCandidates(pc: RTCPeerConnection): Promise<void> {
  const queue = pendingCandidates.get(pc) ?? [];
  pendingCandidates.delete(pc);
  for (const c of queue) await addCandidateSafely(pc, c);
}

function isIncluded(array: StreamEntry[], id: string): boolean {
  return array.some((item) => item.id === id);
}

function createReceiverPC(io: Server, socketId: string, socket: Socket, roomId: string): RTCPeerConnection {
  const pc: RTCPeerConnection = new wrtc.RTCPeerConnection(pc_config);
  receiverPCs[socketId] = pc;

  pc.onicecandidate = (e: RTCPeerConnectionIceEvent) => {
    // socket.to()는 자기 자신을 제외하므로 io.to()로 본인에게 보낸다
    io.to(socketId).emit('getSenderCandidate', { candidate: e.candidate });
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
  io: Server,
  receiverSocketId: string,
  senderSocketId: string,
  socket: Socket,
  roomId: string
): RTCPeerConnection {
  const pc: RTCPeerConnection = new wrtc.RTCPeerConnection(pc_config);

  if (!senderPCs[senderSocketId]) senderPCs[senderSocketId] = [];
  senderPCs[senderSocketId].push({ id: receiverSocketId, pc });

  pc.onicecandidate = (e: RTCPeerConnectionIceEvent) => {
    io.to(receiverSocketId).emit('getReceiverCandidate', {
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
  socket.on(
    'joinRoom',
    (data: { id: string; roomID: string; nickname?: unknown; audio?: unknown; video?: unknown }) => {
    socket.join(data.roomID);
    socketToRoom[socket.id] = data.roomID;

    const me: ParticipantState = {
      id: socket.id,
      nickname: cleanNickname(data.nickname, `게스트-${socket.id.slice(0, 4)}`),
      audio: data.audio === true,
      video: data.video === true,
    };
    const room = (participants[data.roomID] ??= {});
    // 나에게는 이미 있던 참가자 목록, 다른 사람들에게는 내가 들어왔다는 알림
    io.to(socket.id).emit('participants:list', { participants: Object.values(room) });
    room[socket.id] = me;
    socket.broadcast.to(data.roomID).emit('participant:joined', { participant: me });

    const allUsers = getOtherUsers(data.id, data.roomID);
    io.to(data.id).emit('allUsers', { users: allUsers });
    // 늦게 들어온 사람에게 지금까지의 채팅 전달
    io.to(data.id).emit('chat:history', { messages: chatHistory[data.roomID] ?? [] });
    }
  );

  // 마이크·카메라 상태나 닉네임이 바뀌면 방 전체에 알림
  socket.on('participant:update', (data: { nickname?: unknown; audio?: unknown; video?: unknown }) => {
    const roomId = socketToRoom[socket.id];
    const me = roomId ? participants[roomId]?.[socket.id] : undefined;
    if (!me) return;
    if (typeof data?.audio === 'boolean') me.audio = data.audio;
    if (typeof data?.video === 'boolean') me.video = data.video;
    if (data?.nickname !== undefined) me.nickname = cleanNickname(data.nickname, me.nickname);
    io.to(roomId).emit('participant:updated', { participant: me });
  });

  socket.on('chat:send', (data: { text?: unknown; nickname?: unknown }) => {
    const roomId = socketToRoom[socket.id];
    if (!roomId || typeof data?.text !== 'string') return;
    const text = data.text.trim().slice(0, CHAT_TEXT_LIMIT);
    if (!text) return;
    // 참가자 목록에 등록된 닉네임을 우선 사용
    const nickname = participants[roomId]?.[socket.id]?.nickname ?? cleanNickname(data.nickname, '게스트');

    const message: ChatMessage = {
      id: crypto.randomUUID(),
      senderId: socket.id,
      nickname,
      text,
      sentAt: new Date().toISOString(),
    };
    const history = (chatHistory[roomId] ??= []);
    history.push(message);
    if (history.length > CHAT_HISTORY_LIMIT) history.shift();
    io.to(roomId).emit('chat:message', message);
  });

  socket.on(
    'senderOffer',
    async (data: { senderSocketID: string; roomID: string; sdp: RTCSessionDescriptionInit }) => {
      socketToRoom[data.senderSocketID] = data.roomID;
      const pc = createReceiverPC(io, data.senderSocketID, socket, data.roomID);
      await pc.setRemoteDescription(new wrtc.RTCSessionDescription(data.sdp));
      await flushCandidates(pc);
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
      if (pc && data.candidate) await addCandidateSafely(pc, data.candidate);
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
      const pc = createSenderPC(io, data.receiverSocketID, data.senderSocketID, socket, data.roomID);
      await pc.setRemoteDescription(new wrtc.RTCSessionDescription(data.sdp));
      await flushCandidates(pc);
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
      if (entry && data.candidate) await addCandidateSafely(entry.pc, data.candidate);
    }
  );

  socket.on('disconnect', () => {
    const roomId = socketToRoom[socket.id];
    deleteUser(socket.id, roomId);
    closeReceiverPC(socket.id);
    closeSenderPCs(socket.id);
    socket.broadcast.to(roomId).emit('userExit', { id: socket.id });
    if (roomId && participants[roomId]) {
      delete participants[roomId][socket.id];
      if (Object.keys(participants[roomId]).length === 0) delete participants[roomId];
      socket.broadcast.to(roomId).emit('participant:left', { id: socket.id });
    }
    // 마지막 사람이 나가면 채팅 기록 삭제
    if (roomId && !io.sockets.adapter.rooms.get(roomId)?.size) delete chatHistory[roomId];
    console.log(`[Socket] 클라이언트 연결 해제: ${socket.id}`);
  });
}
