import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Prisma } from '@prisma/client';
import prisma from '../config/prisma';
import { User } from '../types';

const JWT_SECRET = process.env.JWT_SECRET || 'facemeet_secret';
const SALT_ROUNDS = 10;

type SafeUser = Omit<User, 'password'>;
const safeUserSelect = { id: true, email: true, nickname: true, state: true, createdAt: true } as const;

export async function register(
  email: string,
  password: string,
  nickname: string
): Promise<{ token: string; user: SafeUser }> {
  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
  try {
    const user = await prisma.user.create({
      data: { email, password: hashedPassword, nickname, state: true },
      select: safeUserSelect,
    });
    const token = jwt.sign({ userId: user.id, email }, JWT_SECRET, { expiresIn: '7d' });
    return { token, user };
  } catch (err) {
    // email 유니크 제약 위반 (동시에 같은 이메일로 가입해도 DB가 막아줌)
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new Error('이미 사용 중인 이메일입니다.');
    }
    throw err;
  }
}

export async function login(email: string, password: string): Promise<{ token: string; user: SafeUser }> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error('이메일 또는 비밀번호가 올바르지 않습니다.');

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) throw new Error('이메일 또는 비밀번호가 올바르지 않습니다.');

  const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
  const { password: _pw, ...safeUser } = user;
  return { token, user: safeUser };
}
