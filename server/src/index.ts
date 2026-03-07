import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';

const app = express();
app.use(cors());

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket', 'polling']
});

// エラーハンドリング
io.engine.on('connection_error', (err) => {
  console.error('Connection error:', err);
});

server.on('error', (err) => {
  console.error('Server error:', err);
});

// RoomId -> Array of { socketId, userName }
const roomUsers: Record<string, Array<{ socketId: string, userName: string }>> = {};
// Socket ID -> { roomId, userName }
const socketRoomMap: Record<string, { roomId: string, userName: string }> = {};

io.on('connection', (socket: Socket) => {
  console.log(`User connected: ${socket.id}`);

  // エラーハンドリング
  socket.on('error', (err) => {
    console.error(`Socket error for ${socket.id}:`, err);
  });

  socket.on('join-room', (payload: { roomId: string, userName: string }) => {
    const { roomId, userName } = payload;
    socket.join(roomId);
    
    if (!roomUsers[roomId]) {
      roomUsers[roomId] = [];
    }
    
    // 重複を避ける
    if (!roomUsers[roomId].find(u => u.socketId === socket.id)) {
      roomUsers[roomId].push({ socketId: socket.id, userName });
    }
    socketRoomMap[socket.id] = { roomId, userName };

    console.log(`User ${socket.id} (${userName}) joined room ${roomId}`);

    // 通知: 新しいユーザーが入室した
    // 既存の参加者（自分以外）に通知する
    socket.to(roomId).emit('user-connected', { 
      userId: socket.id, 
      userName
    });

    // 新規参加者へ: すでに部屋にいる全ユーザーのリストを返す（自分のIDは除く）
    const usersInThisRoom = roomUsers[roomId]
      .filter(u => u.socketId !== socket.id)
      .map(u => ({ 
        userId: u.socketId, 
        userName: u.userName
      }));
    socket.emit('all-users', usersInThisRoom);
  });

  // WebRTC Signaling (Unified)
  socket.on('signal', (payload: { target: string; caller: string; signal: any }) => {
    const callerInfo = socketRoomMap[payload.caller];
    io.to(payload.target).emit('signal', {
      caller: payload.caller,
      signal: payload.signal,
      userName: callerInfo?.userName
    });
  });

  // Note: Track state changes are now handled via WebRTC DataChannel (P2P)
  // No server-side state management needed

  // Disconnect
  socket.on('disconnect', (reason) => {
    console.log(`User disconnected: ${socket.id}, reason: ${reason}`);
    const userInfo = socketRoomMap[socket.id];
    
    if (userInfo) {
      const roomId = userInfo.roomId;
      const usersInRoom = roomUsers[roomId];
      
      if (usersInRoom) {
        roomUsers[roomId] = usersInRoom.filter(u => u.socketId !== socket.id);
        if (roomUsers[roomId]?.length === 0) {
          delete roomUsers[roomId];
        }
        
        // 部屋の残りのユーザーに退出を通知
        socket.to(roomId).emit('user-disconnected', socket.id);
      }
    }
    
    delete socketRoomMap[socket.id];
  });
});

app.get('/', (req, res) => {
  res.send('Signaling Server is running');
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
