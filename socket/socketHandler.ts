import { error } from 'console';
import { Server } from 'socket.io';

const rooms = {}; // 각 방의 사용자 ID를 저장하는 객체
// 키는 방 이름, 값은 해당 방에 속한 사용자 ID의 배열
const user = {};

const socketHandler = (server) => {
  const io = new Server(server, {
    cors: {
      origin: 'http://localhost:3000',
      credentials: true, // 클라이언트가 실행 중인 포트
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);
    let joinedRoom = '';

    socket.on('join_room', (roomName) => {
      console.log(`User ${socket.id} joining room: ${roomName}`);
      joinedRoom = roomName;
      if (!rooms[roomName]) {
        // 방이 존재하지 않으면 새로 생성
        rooms[roomName] = [];
      }

      // 방에 사용자 ID 추가
      rooms[roomName].push(socket.id);
      socket.join(roomName);

      // 특정 방에 참가한 사용자들에게 새로운 사용자가 추가된 참가자 목록 전달
      io.to(roomName).emit('room_users', rooms[roomName]);

      // 기존 사용자들에게 새로 참가한 사용자 정보 전달
      rooms[roomName].forEach((existingUserId) => {
        if (existingUserId !== socket.id) {
          io.to(existingUserId).emit('welcome', { userId: socket.id });
        }
      });
    });

    /*
    // 사용자 연결 해제 시 처리 기존 코드
    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);

      for (const roomName in rooms) {
        if (rooms[roomName].includes(socket.id)) {
          rooms[roomName] = rooms[roomName].filter((id) => id !== socket.id);
          io.to(roomName).emit('room_users', rooms[roomName]);

          if (rooms[roomName].length === 0) {
            delete rooms[roomName];
          }
        }
      }
    });*/

    // 사용자 연결 해제 시 처리 새로운 코드
    socket.on('disconnect', () => {
      console.log(`User ${socket.id} leave`);
      const roomName = joinedRoom;
      socket.leave(roomName);
      if (rooms[roomName]) {
        rooms[roomName] = rooms[roomName].filter((id) => id !== socket.id);
      } else {
        console.log(error);
      }
      io.to(roomName).emit('room_users', rooms[roomName]); // 방에 남아있는 사용자 목록 업데이트
      if (!rooms[roomName] || rooms[roomName].length === 0) {
        delete rooms[roomName];
      }
    });

    /*
    // offer, answer, ICE 처리 기존 코드
    socket.on('offer', ({ offer, roomName, toUserId }) => {
      console.log(`Sending offer from ${socket.id} to ${toUserId} in room ${roomName}`);
      socket.to(toUserId).emit('offer', { offer, userId: socket.id, roomName });
    });
    기존 코드 아래에 해당 부분을 추가하여 방 전체에 offer, answer, ICE 메시지를 전송하도록 변경
          socket.to(roomName).emit('offer', { offer, userId: socket.id, roomName });

    */

    socket.on('offer', ({ offer, roomName, toUserId }) => {
      console.log(`Sending offer from ${socket.id} to ${toUserId} in room ${roomName}`);
      socket.to(toUserId).emit('offer', { offer, userId: socket.id, roomName });
      socket.to(roomName).emit('offer', { offer, userId: socket.id, roomName });
    });

    socket.on('answer', ({ answer, roomName, toUserId }) => {
      console.log(`Sending answer from ${socket.id} to ${toUserId} in room ${roomName}`);
      socket.to(toUserId).emit('answer', { answer, userId: socket.id, roomName });
      socket.to(roomName).emit('answer', { answer, userId: socket.id, roomName });
    });

    socket.on('ice', ({ ice, roomName, toUserId }) => {
      console.log(`Sending ICE from ${socket.id} to ${toUserId} in room ${roomName}`);
      socket.to(toUserId).emit('ice', { ice, userId: socket.id, roomName });
      socket.to(roomName).emit('ice', { ice, userId: socket.id, roomName });
    });

    //채팅을 위한 socket 정의
    socket.on('event1', (msg) => {
      console.log(msg);
      io.emit('getID', socket.id);
    });

    // 모두에게
    socket.on('input', (data) => {
      //console.log(socket.id, " 가 보낸 메세지 : ", data);
      io.emit('msg', { id: socket.id, message: data });
      console.log(user);
    });

    // 본인 제외한 모든 소켓
    socket.on('inputWM', (data) => {
      socket.broadcast.emit('msg', { id: socket.id, message: data });
      //  console.log(socket.id, " 본인 제외 ", data);
      // io.emit("msg") 보내는코드
    });

    // 특정 소켓
    socket.on('private', (id, data) => {
      // console.log(socket.id, " 특정 소켓 ", data);
      io.to(id).emit('msg', { id: socket.id, message: data });
    });
  });
};

export default module.exports = socketHandler;
