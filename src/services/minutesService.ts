import { v4 as uuidv4 } from 'uuid';
import db from '../config/db';
import { Note, EmotionScore, NoteWithScore } from '../types';
import mysql from 'mysql2/promise';

export async function getNotesByMeeting(meetingId: string): Promise<NoteWithScore[]> {
  const [rows] = await db.execute<mysql.RowDataPacket[]>(
    `SELECT n.id, n.meeting_id, n.emotion_score_id, n.date, n.content,
            e.score, e.created_at as score_created_at
     FROM Note n
     LEFT JOIN EmotionScore e ON n.emotion_score_id = e.id
     WHERE n.meeting_id = ?
     ORDER BY n.date DESC`,
    [meetingId]
  );
  return rows.map((row) => ({
    id: row.id,
    meeting_id: row.meeting_id,
    emotion_score_id: row.emotion_score_id,
    date: row.date,
    content: row.content,
    emotion_score: row.score !== null
      ? { id: row.emotion_score_id, meeting_id: row.meeting_id, created_at: row.score_created_at, score: row.score }
      : null,
  }));
}

export async function getNoteById(id: string): Promise<NoteWithScore | null> {
  const [rows] = await db.execute<mysql.RowDataPacket[]>(
    `SELECT n.id, n.meeting_id, n.emotion_score_id, n.date, n.content,
            e.score, e.created_at as score_created_at
     FROM Note n
     LEFT JOIN EmotionScore e ON n.emotion_score_id = e.id
     WHERE n.id = ?`,
    [id]
  );
  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    id: row.id,
    meeting_id: row.meeting_id,
    emotion_score_id: row.emotion_score_id,
    date: row.date,
    content: row.content,
    emotion_score: row.score !== null
      ? { id: row.emotion_score_id, meeting_id: row.meeting_id, created_at: row.score_created_at, score: row.score }
      : null,
  };
}

export async function createNote(
  meetingId: string,
  content: string,
  score: number
): Promise<NoteWithScore> {
  const scoreId = uuidv4();
  const noteId = uuidv4();

  await db.execute(
    'INSERT INTO EmotionScore (id, meeting_id, score, created_at) VALUES (?, ?, ?, NOW())',
    [scoreId, meetingId, score]
  );
  await db.execute(
    'INSERT INTO Note (id, meeting_id, emotion_score_id, date, content) VALUES (?, ?, ?, NOW(), ?)',
    [noteId, meetingId, scoreId, content]
  );

  const note = await getNoteById(noteId);
  if (!note) throw new Error('회의록 생성에 실패했습니다.');
  return note;
}

export async function updateNote(
  id: string,
  data: { content?: string; score?: number }
): Promise<NoteWithScore> {
  const note = await getNoteById(id);
  if (!note) throw new Error('회의록을 찾을 수 없습니다.');

  if (data.content !== undefined) {
    await db.execute('UPDATE Note SET content = ? WHERE id = ?', [data.content, id]);
  }
  if (data.score !== undefined) {
    await db.execute('UPDATE EmotionScore SET score = ? WHERE id = ?', [
      data.score,
      note.emotion_score_id,
    ]);
  }

  const updated = await getNoteById(id);
  if (!updated) throw new Error('회의록 수정에 실패했습니다.');
  return updated;
}

export async function deleteNote(id: string): Promise<void> {
  const note = await getNoteById(id);
  if (!note) throw new Error('회의록을 찾을 수 없습니다.');
  await db.execute('DELETE FROM Note WHERE id = ?', [id]);
  await db.execute('DELETE FROM EmotionScore WHERE id = ?', [note.emotion_score_id]);
}
