import { Request } from 'express';

export interface AuthRequest extends Request {
  userId?: string;
  userEmail?: string;
}

export interface JwtPayload {
  userId: string;
  email: string;
}

export interface User {
  id: string;
  email: string;
  password: string;
  nickname: string;
  state: boolean;
  createdAt: Date;
}

export interface Meeting {
  id: string;
  title: string;
  created_at: Date;
  delete_at: Date | null;
}

export interface Participant {
  id: string;
  user_id: string;
  meeting_id: string;
  joined_at: Date;
  left_at: Date | null;
}

export interface EmotionScore {
  id: string;
  meeting_id: string;
  created_at: Date;
  score: number;
}

export interface Note {
  id: string;
  meeting_id: string;
  emotion_score_id: string;
  date: Date;
  content: string;
}

export interface MeetingWithParticipants extends Meeting {
  participants?: Participant[];
  emotion_score?: EmotionScore | null;
}

export interface NoteWithScore extends Note {
  emotion_score?: EmotionScore | null;
}

// Socket / WebRTC types
export interface WebRTCStream {
  id: string;
  stream: unknown; // wrtc MediaStream
}

export interface RoomUsers {
  [roomId: string]: WebRTCStream[];
}

export interface ReceiverPCs {
  [socketId: string]: RTCPeerConnection;
}

export interface SenderPCEntry {
  id: string;
  pc: RTCPeerConnection;
}

export interface SenderPCs {
  [socketId: string]: SenderPCEntry[];
}

export interface SocketToRoom {
  [socketId: string]: string;
}
