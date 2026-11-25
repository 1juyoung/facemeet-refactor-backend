import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

/**
 * Prisma 클라이언트 (앱 전체에서 하나만 사용)
 * engineType = "client" 설정이라 Rust 엔진 대신 mariadb 드라이버(MySQL 호환)로 접속한다.
 * DATABASE_URL 예: mysql://facemeet:비밀번호@localhost:3306/facemeet
 */
function createAdapter() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL 환경 변수가 없습니다.');
  const { hostname, port, username, password, pathname } = new URL(url);
  return new PrismaMariaDb({
    host: hostname,
    port: Number(port) || 3306,
    user: decodeURIComponent(username),
    password: decodeURIComponent(password),
    database: pathname.slice(1),
    connectionLimit: 5,
    // MySQL 8 기본 인증(caching_sha2_password)을 SSL 없이 쓰려면 필요. DB가 같은 서버(localhost)에 있을 때만 사용
    allowPublicKeyRetrieval: true,
  });
}

const prisma = new PrismaClient({ adapter: createAdapter() });

export default prisma;
