import prisma from '../config/prisma';
import { Meeting, Participant } from '../types';

const meetingSelect = { id: true, title: true, created_at: true, delete_at: true } as const;

/** 내가 참가한(만든 회의 포함) 삭제되지 않은 회의, 최신순 */
export async function getMeetingsByUser(userId: string): Promise<Meeting[]> {
  return prisma.meeting.findMany({
    where: { delete_at: null, participant: { some: { user_id: userId } } },
    orderBy: { created_at: 'desc' },
    select: meetingSelect,
  });
}

export async function getMeetingById(id: string): Promise<Meeting | null> {
  return prisma.meeting.findFirst({ where: { id, delete_at: null }, select: meetingSelect });
}

export async function createMeeting(title: string, userId: string): Promise<Meeting> {
  // 회의와 생성자의 참가 기록을 한 번에 (중첩 create는 하나의 트랜잭션으로 처리됨)
  return prisma.meeting.create({
    data: { title, participant: { create: { user_id: userId } } },
    select: meetingSelect,
  });
}

export async function deleteMeeting(id: string, userId: string): Promise<void> {
  const participant = await prisma.participant.findUnique({
    where: { meeting_id_user_id: { meeting_id: id, user_id: userId } },
    select: { id: true },
  });
  if (!participant) throw new Error('삭제 권한이 없습니다.');
  // 실제 삭제 대신 delete_at 기록 (소프트 삭제)
  await prisma.meeting.update({ where: { id }, data: { delete_at: new Date() } });
}

export async function joinMeeting(meetingId: string, userId: string): Promise<Participant> {
  const meeting = await getMeetingById(meetingId);
  if (!meeting) throw new Error('회의를 찾을 수 없습니다.');

  // 이미 참가 기록이 있으면 그대로 돌려준다 (meeting_id + user_id 유니크)
  return prisma.participant.upsert({
    where: { meeting_id_user_id: { meeting_id: meetingId, user_id: userId } },
    update: {},
    create: { meeting_id: meetingId, user_id: userId },
  });
}
