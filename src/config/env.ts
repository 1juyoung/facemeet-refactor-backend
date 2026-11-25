function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`환경 변수 ${name}가 설정되지 않았습니다. .env를 확인하세요.`);
  }
  return value;
}

export const JWT_SECRET = required('JWT_SECRET');
