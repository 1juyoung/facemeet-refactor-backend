import bcrypt from 'bcryptjs';
import prisma from '../config/prisma';
import { User } from '../types';

const SALT_ROUNDS = 10;
const safeUserSelect = { id: true, email: true, nickname: true, state: true, createdAt: true } as const;

export async function getUserById(id: string): Promise<Omit<User, 'password'> | null> {
  return prisma.user.findUnique({ where: { id }, select: safeUserSelect });
}

export async function updateProfile(
  id: string,
  data: { nickname?: string; password?: string }
): Promise<Omit<User, 'password'>> {
  const exists = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!exists) throw new Error('사용자를 찾을 수 없습니다.');

  return prisma.user.update({
    where: { id },
    data: {
      ...(data.nickname ? { nickname: data.nickname } : {}),
      ...(data.password ? { password: await bcrypt.hash(data.password, SALT_ROUNDS) } : {}),
    },
    select: safeUserSelect,
  });
}
