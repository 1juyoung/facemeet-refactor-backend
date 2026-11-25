import crypto from 'crypto';

export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

const STUN_URL = process.env.STUN_URL || 'stun:stun.l.google.com:19302';

/** 서버(wrtc)가 사용하는 ICE 설정. 서버는 공인 IP를 가지므로 STUN만 사용한다. */
export function getServerIceServers(): IceServer[] {
  return [{ urls: STUN_URL }];
}

/**
 * 클라이언트에 내려주는 ICE 설정.
 * TURN 비밀키는 서버에만 두고, coturn의 use-auth-secret 방식으로 만료 시간이 있는 임시 자격 증명을 발급한다.
 */
export function getClientIceServers(userId = 'facemeet'): IceServer[] {
  const servers: IceServer[] = [{ urls: STUN_URL }];
  const turnUrl = process.env.TURN_URL;
  const secret = process.env.TURN_SECRET;
  if (!turnUrl || !secret) return servers;

  const ttlSeconds = Number(process.env.TURN_TTL_SECONDS) || 60 * 60 * 6;
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  const username = `${expiresAt}:${userId}`;
  const credential = crypto.createHmac('sha1', secret).update(username).digest('base64');

  servers.push({ urls: turnUrl.split(',').map((u) => u.trim()), username, credential });
  return servers;
}
