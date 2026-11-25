import { v4 as uuidv4 } from 'uuid';
import db from '../config/db';
import { Meeting, Participant } from '../types';
import mysql from 'mysql2/promise';

export async function getMeetingsByUser(userId: string): Promise<Meeting[]> {
  const [rows] = await db.execute<mysql.RowDataPacket[]>(
    `SELECT m.id, m.title, m.created_at, m.delete_at
     FROM Meeting m
     INNER JOIN Participant p ON m.id = p.meeting_id
     WHERE p.user_id = ? AND m.delete_at IS NULL
     ORDER BY m.created_at DESC`,
    [userId]
  );
  return rows as Meeting[];
}

export async function getMeetingById(id: string): Promise<Meeting | null> {
  const [rows] = await db.execute<mysql.RowDataPacket[]>(
    'SELECT id, title, created_at, delete_at FROM Meeting WHERE id = ? AND delete_at IS NULL',
    [id]
  );
  return rows.length > 0 ? (rows[0] as Meeting) : null;
}

export async function createMeeting(
  title: string,
  userId: string
): Promise<Meeting> {
  const meetingId = uuidv4();
  const participantId = uuidv4();

  await db.execute('INSERT INTO Meeting (id, title, created_at) VALUES (?, ?, NOW())', [
    meetingId,
    title,
  ]);

  // 생성자는 자동으로 참가자로 등록
  await db.execute(
    'INSERT INTO Participant (id, user_id, meeting_id, joined_at) VALUES (?, ?, ?, NOW())',
    [participantId, userId, meetingId]
  );

  const meeting = await getMeetingById(meetingId);
  if (!meeting) throw new Error('회의 생성에 실패했습니다.');
  return meeting;
}

export async function deleteMeeting(id: string, userId: string): Promise<void> {
  const [rows] = await db.execute<mysql.RowDataPacket[]>(
    `SELECT p.id FROM Participant p
     WHERE p.meeting_id = ? AND p.user_id = ?`,
    [id, userId]
  );
  if (rows.length === 0) throw new Error('삭제 권한이 없습니다.');
  await db.execute('UPDATE Meeting SET delete_at = NOW() WHERE id = ?', [id]);
}

export async function joinMeeting(
  meetingId: string,
  userId: string
): Promise<Participant> {
  const meeting = await getMeetingById(meetingId);
  if (!meeting) throw new Error('회의를 찾을 수 없습니다.');

  const [existing] = await db.execute<mysql.RowDataPacket[]>(
    'SELECT id FROM Participant WHERE meeting_id = ? AND user_id = ?',
    [meetingId, userId]
  );
  if (existing.length > 0) {
    return existing[0] as Participant;
  }

  const participantId = uuidv4();
  await db.execute(
    'INSERT INTO Participant (id, user_id, meeting_id, joined_at) VALUES (?, ?, ?, NOW())',
    [participantId, userId, meetingId]
  );

  const [rows] = await db.execute<mysql.RowDataPacket[]>(
    'SELECT * FROM Participant WHERE id = ?',
    [participantId]
  );
  return rows[0] as Participant;
}
