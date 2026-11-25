import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import mysql from 'mysql2/promise';
import db from '../config/db';
import { User } from '../types';

const JWT_SECRET = process.env.JWT_SECRET || 'facemeet_secret';
const SALT_ROUNDS = 10;

export async function register(
  email: string,
  password: string,
  nickname: string
): Promise<{ token: string; user: Omit<User, 'password'> }> {
  const [rows] = await db.execute<mysql.RowDataPacket[]>('SELECT id FROM User WHERE email = ?', [
    email,
  ]);
  if (rows.length > 0) throw new Error('이미 사용 중인 이메일입니다.');

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
  const id = uuidv4();
  await db.execute(
    'INSERT INTO User (id, email, password, nickname, state, createdAt) VALUES (?, ?, ?, ?, ?, NOW())',
    [id, email, hashedPassword, nickname, true]
  );

  const token = jwt.sign({ userId: id, email }, JWT_SECRET, { expiresIn: '7d' });
  return { token, user: { id, email, nickname, state: true, createdAt: new Date() } };
}

export async function login(
  email: string,
  password: string
): Promise<{ token: string; user: Omit<User, 'password'> }> {
  const [rows] = await db.execute<mysql.RowDataPacket[]>(
    'SELECT id, email, password, nickname, state, createdAt FROM User WHERE email = ?',
    [email]
  );
  if (rows.length === 0) throw new Error('이메일 또는 비밀번호가 올바르지 않습니다.');

  const user = rows[0] as User;
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) throw new Error('이메일 또는 비밀번호가 올바르지 않습니다.');

  const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
  const { password: _pw, ...safeUser } = user;
  return { token, user: safeUser };
}
