import bcrypt from 'bcryptjs';
import db from '../config/db';
import { User } from '../types';
import mysql from 'mysql2/promise';

const SALT_ROUNDS = 10;

export async function getUserById(id: string): Promise<Omit<User, 'password'> | null> {
  const [rows] = await db.execute<mysql.RowDataPacket[]>(
    'SELECT id, email, nickname, state, createdAt FROM User WHERE id = ?',
    [id]
  );
  return rows.length > 0 ? (rows[0] as Omit<User, 'password'>) : null;
}

export async function updateProfile(
  id: string,
  data: { nickname?: string; password?: string }
): Promise<Omit<User, 'password'>> {
  if (data.password) {
    const hashed = await bcrypt.hash(data.password, SALT_ROUNDS);
    await db.execute('UPDATE User SET password = ? WHERE id = ?', [hashed, id]);
  }
  if (data.nickname) {
    await db.execute('UPDATE User SET nickname = ? WHERE id = ?', [data.nickname, id]);
  }
  const updated = await getUserById(id);
  if (!updated) throw new Error('사용자를 찾을 수 없습니다.');
  return updated;
}
