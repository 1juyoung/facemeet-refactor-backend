import prisma from '../config/prisma';
import { NoteWithScore } from '../types';

const noteInclude = { emotionscore: true } as const;

type NoteRow = {
  id: string;
  meeting_id: string;
  emotion_score_id: string;
  date: Date;
  content: string;
  emotionscore: { id: string; meeting_id: string; created_at: Date; score: number } | null;
};

/** 기존 API 응답 형태(emotion_score 필드) 유지 */
function toNoteWithScore({ emotionscore, ...note }: NoteRow): NoteWithScore {
  return { ...note, emotion_score: emotionscore };
}

export async function getNotesByMeeting(meetingId: string): Promise<NoteWithScore[]> {
  const notes = await prisma.note.findMany({
    where: { meeting_id: meetingId },
    orderBy: { date: 'desc' },
    include: noteInclude,
  });
  return notes.map(toNoteWithScore);
}

export async function getNoteById(id: string): Promise<NoteWithScore | null> {
  const note = await prisma.note.findUnique({ where: { id }, include: noteInclude });
  return note ? toNoteWithScore(note) : null;
}

export async function createNote(meetingId: string, content: string, score: number): Promise<NoteWithScore> {
  // 감정 점수와 회의록을 함께 생성 (중첩 create → 하나의 트랜잭션)
  const note = await prisma.note.create({
    data: {
      content,
      meeting: { connect: { id: meetingId } },
      emotionscore: { create: { score, meeting: { connect: { id: meetingId } } } },
    },
    include: noteInclude,
  });
  return toNoteWithScore(note);
}

export async function updateNote(id: string, data: { content?: string; score?: number }): Promise<NoteWithScore> {
  const note = await prisma.note.findUnique({ where: { id }, select: { id: true } });
  if (!note) throw new Error('회의록을 찾을 수 없습니다.');

  const updated = await prisma.note.update({
    where: { id },
    data: {
      ...(data.content !== undefined ? { content: data.content } : {}),
      ...(data.score !== undefined ? { emotionscore: { update: { score: data.score } } } : {}),
    },
    include: noteInclude,
  });
  return toNoteWithScore(updated);
}

export async function deleteNote(id: string): Promise<void> {
  const note = await prisma.note.findUnique({ where: { id }, select: { emotion_score_id: true } });
  if (!note) throw new Error('회의록을 찾을 수 없습니다.');
  // 회의록 → 감정 점수 순서로 삭제 (외래 키 때문에), 둘 중 하나만 지워지지 않게 트랜잭션
  await prisma.$transaction([
    prisma.note.delete({ where: { id } }),
    prisma.emotionScore.delete({ where: { id: note.emotion_score_id } }),
  ]);
}
