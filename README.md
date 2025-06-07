<div align="center">

# 🛠️ FaceMeet Backend (Refactored)

### 클린 아키텍처 기반의 화상 회의 백엔드

Express + Socket.io + MongoDB + Clean Architecture

---

</div>

## 📌 소개

이 저장소는 FaceMeet의 백엔드 리팩토링 버전입니다.  
원래는 팀 프로젝트(졸업작품)으로 개발되었으며, 현재는 클린 아키텍처를 적용해 **유지보수성과 확장성**을 높이고 있습니다.

> 실시간 채팅, 시그널링 서버, 회의록 저장
> WebRTC 기반 화상회의의 핵심 백엔드 로직을 담당합니다.

⚠️ **회원가입, 로그인, 기본 CRUD 등 일반적인 로직은 프론트엔드 레포지토리에 구현되어 있습니다.**  
👉 [📦 FaceMeet Frontend 레포지토리 바로가기](https://github.com/1juyoung/facemeet-refactor-frontend)

---

## 🧱 아키텍처

**Clean Architecture** 패턴 적용:  
`domain → application → infrastructure` 계층으로 분리하여 관심사를 명확히 구분했습니다.

---

## ✨ 주요 기능

- 📞 WebRTC 시그널링 서버 (Socket.io)
- 💬 실시간 채팅 저장 및 전송

---

## 💾 ERD (Entity Relationship Diagram)

<div align="center">
<img src="docs/facemeet_ERD.png" alt="Eat the Weather Logo" width="500"/>
</div>

## ⚙️ 기술 스택

| 영역         | 기술                         |
| ------------ | ---------------------------- |
| 언어         | TypeScript, JavaScript       |
| 런타임       | Node.js                      |
| 프레임워크   | Express, Socket.io           |
| 데이터베이스 | MongoDB + Mongoose           |
| 인증         | JWT                          |
| 구조 설계    | Clean Architecture, REST API |

---

## 🧪 실행 방법

```bash
# 1. 의존성 설치
npm install

# 2. 환경 변수 설정 (.env 파일 생성)
cp .env.example .env

# 3. 개발 모드 실행 (ts-node + nodemon)
npx nodemon
```
