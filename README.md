# FaceMeet Backend

### REST API · Signaling · SFU Server

**FaceMeet 화상회의의 API, 실시간 통신, 영상 중계를 담당하는 서버**

회원가입·로그인, 회의·회의록 API와 함께 Socket.IO 시그널링, 서버가 영상을 받아 나눠 주는 SFU, 참가자 상태 동기화와 채팅을 처리합니다. <br />
프론트엔드는 화면만 담당하고, 인증과 DB 접근은 모두 이 서버를 거칩니다.

📎 **Frontend** [프론트엔드 리팩토링](https://github.com/1juyoung/facemeet-refactor-frontend) · **Original (졸업작품)** [오리지널 코드](https://github.com/1juyoung/facemeet)

---

## Tech Stack

| 영역 | 기술 |
|---|---|
| Runtime | Node.js 22, TypeScript |
| API | Express 5, JWT, bcrypt |
| Real-time | Socket.IO, `@roamhq/wrtc` (SFU) |
| Database | MySQL 8, Prisma |
| Infra | AWS EC2 (Ubuntu), Caddy (HTTPS), coturn (TURN), systemd |

## Structure

`routes → controllers → services → Prisma(MySQL)` 순서의 계층 구조입니다.

```
src
├─ routes        # URL과 인증 미들웨어 연결
├─ controllers   # 요청 검증, HTTP 상태 코드 결정
├─ services      # 비즈니스 로직, Prisma로 DB 접근
├─ socket        # 시그널링, SFU, 참가자 상태, 채팅
├─ middleware    # JWT 인증, 에러 처리
└─ config        # Prisma 클라이언트, ICE(STUN/TURN) 설정
prisma           # 스키마와 마이그레이션 SQL
deploy           # Caddy, coturn, systemd 설정 파일
```

---

## How It Works

### 영상 연결 (SFU)
참가자는 서버와 **송신 연결 1개**, 다른 참가자마다 **수신 연결 1개**를 맺습니다.
서버가 각 참가자의 영상을 한 번 받아 나머지 참가자에게 전달하므로, 참가자가 늘어도 브라우저가 올리는 영상은 1개로 유지됩니다.

```
참가자 A ──송신──▶ 서버 ──▶ 참가자 B, C 에게 전달
참가자 B ──송신──▶ 서버 ──▶ 참가자 A, C 에게 전달
```

### 참가자 상태와 영상 연결 분리
참가자 목록(닉네임·마이크·카메라 상태)은 영상 연결과 별도로 서버가 관리합니다.
그래서 카메라·마이크 권한을 거부한 사람도 방에 입장해 다른 참가자 화면을 보고, 다른 참가자 화면에는 블록으로 표시됩니다.

### TURN 임시 자격 증명
UDP가 막힌 네트워크를 위해 coturn을 사용합니다. 고정 비밀번호를 프론트엔드에 넣지 않고, 서버가 `/api/ice-servers` 요청마다 만료 시간이 있는 자격 증명(HMAC)을 발급합니다.

---

## API

| Method | Path | 설명 | 인증 |
|---|---|---|---|
| POST | `/api/auth/register` | 회원가입 | |
| POST | `/api/auth/login` | 로그인 (JWT 발급) | |
| GET · PUT | `/api/users/profile` | 내 정보 조회·수정 | ✅ |
| GET · POST | `/api/meetings` | 내 회의 목록 · 회의 만들기 | ✅ |
| GET · DELETE | `/api/meetings/:id` | 회의 조회 · 삭제(소프트 삭제) | ✅ |
| PUT | `/api/meetings/:id/join` | 회의 참가 | ✅ |
| GET · POST | `/api/meetings/:meetingId/minutes` | 회의록 목록 · 작성 | ✅ |
| GET · PUT · DELETE | `/api/minutes/:id` | 회의록 조회·수정·삭제 | ✅ |
| GET | `/api/ice-servers` | STUN/TURN 설정 (TURN 임시 자격 증명) | |

## Socket Events

| 분류 | 클라이언트 → 서버 | 서버 → 클라이언트 |
|---|---|---|
| 입장·퇴장 | `joinRoom` | `allUsers`, `userEnter`, `userExit` |
| 영상 연결 | `senderOffer`, `receiverOffer`, `senderCandidate`, `receiverCandidate` | `getSenderAnswer`, `getReceiverAnswer`, `getSenderCandidate`, `getReceiverCandidate` |
| 참가자 상태 | `participant:update` | `participants:list`, `participant:joined`, `participant:updated`, `participant:left` |
| 채팅 | `chat:send` | `chat:history`, `chat:message` |

---

## Database

<img src="docs/facemeet_ERD.png" alt="FaceMeet ERD" width="500" />

`User` · `Meeting` · `Participant` · `Note`(회의록) · `EmotionScore`(감정 점수)
스키마는 [`prisma/schema.prisma`](prisma/schema.prisma), 테이블 생성 SQL은 [`prisma/migrations`](prisma/migrations)에 있습니다.

---

## Getting Started

```bash
npm install
cp .env.example .env     # DATABASE_URL, JWT_SECRET 등 입력
npm run db:migrate       # MySQL에 테이블 생성
npm run dev              # 개발 서버 (http://localhost:3001)
```
