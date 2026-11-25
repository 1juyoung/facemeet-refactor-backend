# FaceMeet 배포 가이드 (1단계: 영상 통화 동작 확인)

목표: **서로 다른 네트워크(집 와이파이 ↔ 휴대폰 LTE)에서 영상 통화가 되는지** 확인합니다.
이 단계에서는 DB가 필요 없습니다. 회의실(`/meeting/:id`)은 소켓만 사용합니다.

```
[브라우저] ──HTTPS──> Vercel (Next.js 프론트)
    │
    ├──HTTPS/WSS──> Caddy :443 ──> Node :3001 (REST API + Socket.IO + wrtc SFU)
    ├──UDP 32768-60999──> wrtc SFU (영상·음성)
    └──TURN 3478 / 49160-49200──> coturn (UDP가 막힌 네트워크용 중계)
```

---

## 0. 비용 안전장치 (먼저!)
1. AWS 가입 시 **무료 플랜(Free plan)** 선택 → 크레딧 소진 또는 6개월 후 계정이 정지될 뿐 요금이 자동 청구되지 않습니다.
2. 결제 콘솔 → **Budgets** → 월 $5 예산 + 이메일 알림 설정
3. 공인 IPv4 주소는 시간당 과금 항목이라 크레딧에서 차감됩니다. 테스트가 끝나면 인스턴스를 **중지**하세요.

## 1. EC2 만들기 (리전: 서울 ap-northeast-2)
| 항목 | 값 |
|---|---|
| AMI | Ubuntu Server 24.04 LTS, **64비트(x86)** (wrtc 바이너리 호환) |
| 인스턴스 유형 | 콘솔에 **"프리 티어 사용 가능"** 표시된 소형 유형 (t3.micro 등) |
| 키 페어 | 새로 생성(.pem) 후 안전하게 보관 |
| 스토리지 | 20GB gp3 |

### 보안 그룹 인바운드 규칙
| 유형 | 프로토콜 | 포트 | 소스 | 용도 |
|---|---|---|---|---|
| SSH | TCP | 22 | **내 IP** | 서버 접속 |
| HTTP | TCP | 80 | 0.0.0.0/0 | 인증서 발급 |
| HTTPS | TCP | 443 | 0.0.0.0/0 | API, 소켓 |
| 사용자 지정 | TCP | 3478 | 0.0.0.0/0 | TURN |
| 사용자 지정 | UDP | 3478 | 0.0.0.0/0 | TURN |
| 사용자 지정 | UDP | 49160-49200 | 0.0.0.0/0 | TURN 중계 |
| 사용자 지정 | UDP | 32768-60999 | 0.0.0.0/0 | wrtc SFU 미디어 |

> 마지막 줄이 넓은 이유: wrtc는 미디어 포트 범위를 지정하는 옵션이 없어 리눅스 임시 포트 범위 전체를 씁니다.
> mediasoup으로 바꾸면 `rtcMinPort / rtcMaxPort`로 좁힐 수 있습니다. (전환 시 개선 포인트)

### 탄력적 IP
EC2 → 탄력적 IP → 할당 → 인스턴스에 연결. (재시작해도 IP가 바뀌지 않게)

## 2. 도메인 (무료)
1. https://www.duckdns.org 에서 로그인 → 서브도메인 생성 (예: `facemeet-jy`)
2. current ip 에 **탄력적 IP** 입력 → `facemeet-jy.duckdns.org`
3. 아래에서 `DOMAIN` 은 이 주소를 뜻합니다.

## 3. 서버 기본 설정
```bash
ssh -i key.pem ubuntu@<탄력적IP>

# 메모리 1GB 대비 스왑 2GB
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs git
```

## 4. 백엔드 배포
```bash
# 비공개 저장소면 GitHub Personal Access Token(읽기 권한)으로 clone
git clone -b dev https://github.com/1juyoung/facemeet-refactor-backend.git
cd facemeet-refactor-backend
npm ci
npm run build

cp .env.example .env
nano .env
```
`.env` 예시:
```
PORT=3001
FRONTEND_URL=https://<vercel 주소>
JWT_SECRET=<긴 랜덤 문자열>
STUN_URL=stun:stun.l.google.com:19302
TURN_URL=turn:DOMAIN:3478?transport=udp,turn:DOMAIN:3478?transport=tcp
TURN_SECRET=<긴 랜덤 문자열 — coturn 설정과 동일>
# DATABASE_URL 은 회원가입·회의 API용 (11. DB 설정 참고)
```
랜덤 문자열 만들기: `openssl rand -hex 32`

서비스 등록:
```bash
sudo cp deploy/facemeet-backend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now facemeet-backend
sudo systemctl status facemeet-backend   # active (running) 확인
curl localhost:3001/health               # {"status":"ok"}
```

## 5. HTTPS (Caddy)
```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy

sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
sudo sed -i 's/DOMAIN/<실제 도메인>/' /etc/caddy/Caddyfile
sudo systemctl reload caddy
curl https://<도메인>/health              # {"status":"ok"}
```
(설치 명령이 바뀌었으면 https://caddyserver.com/docs/install#debian-ubuntu-raspbian 참고)

## 6. TURN (coturn)
```bash
sudo apt install -y coturn
TOKEN=$(curl -s -X PUT http://169.254.169.254/latest/api/token -H "X-aws-ec2-metadata-token-ttl-seconds: 60")
curl -s -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/local-ipv4   # 내부 IP 확인

sudo cp deploy/turnserver.conf /etc/turnserver.conf
sudo nano /etc/turnserver.conf     # PUBLIC_IP / PRIVATE_IP / DOMAIN / TURN_SECRET 교체
echo 'TURNSERVER_ENABLED=1' | sudo tee /etc/default/coturn
sudo systemctl enable --now coturn && sudo systemctl restart coturn
curl https://<도메인>/api/ice-servers   # TURN 항목과 username/credential 이 보이면 OK
```

## 7. 프론트엔드 (Vercel)
1. https://vercel.com → GitHub로 로그인 → `facemeet-refactor-frontend` Import (브랜치 `dev`)
2. Environment Variables
   - `NEXT_PUBLIC_API_URL` = `https://<도메인>/api`
   - `NEXT_PUBLIC_SOCKET_URL` = `https://<도메인>`
3. Deploy → 나온 주소를 백엔드 `.env`의 `FRONTEND_URL` 에 넣고 `sudo systemctl restart facemeet-backend`

## 8. 동작 확인 체크리스트
- [ ] `https://<도메인>/health` 응답
- [ ] 노트북(와이파이)에서 `https://<vercel 주소>/meeting/test` 입장
- [ ] 휴대폰 **LTE**(와이파이 끄기)로 같은 주소 입장 → 서로 영상이 보임
- [ ] 한쪽이 나가면 다른 쪽에서 타일이 사라짐
- [ ] Chrome `chrome://webrtc-internals` 에서 연결된 candidate 종류 확인 (`srflx` 직접 연결 / `relay` TURN 경유)
- [ ] TURN 단독 확인: [Trickle ICE](https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/)에 `/api/ice-servers`의 TURN 값 입력 → `relay` 후보가 나오면 OK

## 9. 자주 막히는 곳
| 증상 | 확인할 것 |
|---|---|
| 소켓 연결 안 됨 / CORS 오류 | 백엔드 `.env` 의 `FRONTEND_URL` 이 Vercel 주소와 정확히 같은지 (끝의 `/` 없이) |
| 카메라 권한 창이 안 뜸 | HTTPS 주소로 접속했는지 (http에서는 브라우저가 카메라를 막음) |
| 같은 와이파이에선 되는데 LTE에선 안 됨 | 보안 그룹 UDP 32768-60999, TURN 포트, coturn `external-ip` |
| 인증서 발급 실패 | 80/443 포트 열림, DuckDNS IP가 탄력적 IP인지 |
| 서버가 자꾸 죽음 | `journalctl -u facemeet-backend -f` 로그, 스왑 설정 |

## 10. 측정 (mediasoup 전환 판단용)
참가자 2명 / 4명 / 6명일 때 각각 기록합니다.
- 서버: `top` 또는 `htop` 으로 node 프로세스 CPU·메모리
- 브라우저: `chrome://webrtc-internals` 의 수신 비트레이트, 패킷 손실, 초당 프레임
- 결과를 표로 남겨두면 "왜 mediasoup으로 바꿨는지 / 바꾸지 않았는지"를 수치로 설명할 수 있습니다.

## 11. DB 설정 (MySQL 8 + Prisma)
DB는 같은 EC2 안에서만 접근합니다. **보안 그룹에 3306 포트를 열지 마세요.**

### 11-1. MySQL 설치 (메모리 1GB용으로 가볍게)
```bash
sudo apt install -y mysql-server

# 메모리 사용량 줄이기 (기본 설정은 1GB 서버에 무거움)
sudo tee /etc/mysql/mysql.conf.d/zz-facemeet.cnf > /dev/null <<'CNF'
[mysqld]
bind-address = 127.0.0.1
performance_schema = OFF
innodb_buffer_pool_size = 64M
innodb_log_buffer_size = 8M
max_connections = 30
key_buffer_size = 8M
table_open_cache = 200
CNF
sudo systemctl restart mysql
```

### 11-2. DB와 전용 계정 만들기
```bash
DB_PW=$(openssl rand -hex 16); echo "DB 비밀번호: $DB_PW"   # 메모해 두기
sudo mysql <<SQL
CREATE DATABASE facemeet CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'facemeet'@'localhost' IDENTIFIED BY '$DB_PW';
GRANT ALL PRIVILEGES ON facemeet.* TO 'facemeet'@'localhost';
SQL
```

### 11-3. 백엔드에 연결하고 테이블 만들기
```bash
cd ~/facemeet-refactor-backend
nano .env    # 아래 한 줄 추가 (비밀번호는 위에서 만든 값)
# DATABASE_URL=mysql://facemeet:<DB 비밀번호>@localhost:3306/facemeet

git pull && npm ci
set -a; source .env; set +a      # .env 값을 현재 셸에 불러오기 (prisma 명령용)
npm run db:migrate               # prisma/migrations 를 DB에 적용 → User, Meeting ... 테이블 생성
npm run build
sudo systemctl restart facemeet-backend
```

확인:
```bash
sudo mysql facemeet -e "SHOW TABLES;"     # 5개 테이블 + _prisma_migrations
curl -s -X POST https://<도메인>/api/auth/register -H 'Content-Type: application/json' \
  -d '{"email":"test@test.com","password":"test1234","nickname":"테스트"}'   # token 이 오면 OK
```

### 11-4. 이후 스키마를 바꿀 때
1. `prisma/schema.prisma` 수정
2. 로컬에서 `npx prisma migrate dev --name <변경내용>` → `prisma/migrations/` 에 SQL 생성 → 커밋
3. 서버에서 `git pull && npm ci && npm run db:migrate && npm run build && sudo systemctl restart facemeet-backend`

### 11-5. 백업 (선택)
```bash
sudo mysqldump facemeet > ~/facemeet-$(date +%F).sql
```

## 다음 단계
- 디자인 시안대로 나머지 화면(회의록, 프로필, 인증) 구현
- 백엔드 CI/CD (push 시 자동 배포)
