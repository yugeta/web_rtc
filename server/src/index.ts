import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { ensureDirectories, appendMessage, getHistory, archiveLog } from './chatLogManager';
import { startScheduler } from './archiveScanner';
import authRouter from './routes/auth';
import roomsRouter from './routes/rooms';
import adminRouter from './routes/admin';
import pushRouter from './routes/push';
import { authMiddleware } from './middleware/auth';
import { adminMiddleware } from './middleware/admin';
import type { JwtUserPayload } from './middleware/auth';
import * as userStore from './userStore';
import * as roomStore from './roomStore';
import { setUserVisibility, setRoomParticipants, buildChatPayload, buildJoinPayload, sendToRoom } from './pushService';

// 必須環境変数のバリデーション
const requiredEnvVars = ['GOOGLE_CLIENT_ID', 'JWT_SECRET'] as const;
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Error: ${envVar} environment variable is not set`);
    process.exit(1);
  }
}

// VAPID 鍵の存在チェック（プッシュ通知用）
const vapidEnvVars = ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT'] as const;
const missingVapidVars = vapidEnvVars.filter((v) => !process.env[v]);
if (missingVapidVars.length > 0) {
  console.warn(
    `Warning: Push notification disabled. Missing VAPID env vars: ${missingVapidVars.join(', ')}`
  );
}
export const pushEnabled = missingVapidVars.length === 0;

const app = express();
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false
}));

// OPTIONSプリフライトに明示的に応答
app.options('{*path}', cors());

app.use(express.json());

// 認証ルートと Room ルートをマウント
app.use('/api/auth', authRouter);
app.use('/api/rooms', roomsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/push', pushRouter);

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket', 'polling'],
  allowEIO3: true
});

// Socket.IO JWT 認証ミドルウェア
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env['JWT_SECRET']!) as JwtUserPayload;
      socket.data.user = decoded;
    } catch {
      // 無効な JWT でも接続を拒否しない（未認証ユーザーとして扱う）
    }
  }
  next();
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
// RoomId -> 開始時刻（最初のユーザーが入室した時刻）
const roomStartedAt: Record<string, string> = {};

// Visibility 状態管理: key = `${userSub}:${roomId}`, value = 'foreground' | 'background'
const userVisibility = new Map<string, 'foreground' | 'background'>();
setUserVisibility(userVisibility);

// ルーム参加者管理: roomId -> Set<userSub>
const roomParticipants = new Map<string, Set<string>>();
setRoomParticipants(roomParticipants);

// ヘルスチェック API（admin のみ）
app.get('/api/admin/health', authMiddleware, adminMiddleware, (_req, res) => {
  const mem = process.memoryUsage();
  res.json({
    uptime: Math.floor(process.uptime()),
    memoryUsage: { rss: mem.rss, heapUsed: mem.heapUsed, heapTotal: mem.heapTotal },
    activeRooms: Object.keys(roomUsers).length,
    activeConnections: io.engine.clientsCount,
    registeredUsers: userStore.load().length,
    totalRooms: roomStore.load().length,
    timestamp: new Date().toISOString(),
  });
});

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
    
    // 最初のユーザーが入室した時刻を記録
    if (!roomStartedAt[roomId]) {
      roomStartedAt[roomId] = new Date().toISOString();
    }
    
    // 重複を避ける
    if (!roomUsers[roomId].find(u => u.socketId === socket.id)) {
      roomUsers[roomId].push({ socketId: socket.id, userName });
    }
    socketRoomMap[socket.id] = { roomId, userName };

    // roomParticipants を更新（認証済みユーザーのみ）
    const user = socket.data.user;
    if (user?.sub) {
      if (!roomParticipants.has(roomId)) {
        roomParticipants.set(roomId, new Set());
      }
      roomParticipants.get(roomId)!.add(user.sub);
      // デフォルトで foreground 状態に設定
      userVisibility.set(`${user.sub}:${roomId}`, 'foreground');
    }

    console.log(`User ${socket.id} (${userName}) joined room ${roomId}`);

    // 通知: 新しいユーザーが入室した
    // 既存の参加者（自分以外）に通知する
    socket.to(roomId).emit('user-connected', { 
      userId: socket.id, 
      userName
    });

    // Push notification to background participants (fire and forget)
    const joinerSub = socket.data.user?.sub;
    const room = roomStore.findById(roomId);
    if (room) {
      const joinPayload = buildJoinPayload(roomId, room.name, userName);
      sendToRoom(roomId, joinPayload, joinerSub).catch(() => {});
    }

    // 新規参加者へ: すでに部屋にいる全ユーザーのリストを返す（自分のIDは除く）
    const usersInThisRoom = roomUsers[roomId]
      .filter(u => u.socketId !== socket.id)
      .map(u => ({ 
        userId: u.socketId, 
        userName: u.userName
      }));
    socket.emit('all-users', usersInThisRoom);
    socket.emit('room-started-at', roomStartedAt[roomId]);

    // Send chat history to the joining user
    const history = getHistory(roomId);
    if (history.length > 0) {
      socket.emit('chat-history', history);
    }
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

  // Chat message
  socket.on('chat-message', (payload: { message: string }) => {
    const userInfo = socketRoomMap[socket.id];
    if (!userInfo) return;

    const chatMessage = {
      userName: userInfo.userName,
      message: payload.message,
      timestamp: Date.now()
    };

    appendMessage(userInfo.roomId, chatMessage);
    io.to(userInfo.roomId).emit('chat-message', chatMessage);

    // Push notification to background participants (fire and forget)
    const senderSub = socket.data.user?.sub;
    const room = roomStore.findById(userInfo.roomId);
    if (room) {
      const pushPayload = buildChatPayload(userInfo.roomId, room.name, userInfo.userName, payload.message);
      sendToRoom(userInfo.roomId, pushPayload, senderSub).catch(() => {});
    }
  });

  // Visibility 状態管理
  socket.on('visibility-state', (payload: { state: 'foreground' | 'background', roomId: string }) => {
    const user = socket.data.user;
    if (!user?.sub) return;

    const { state, roomId } = payload;
    if (state !== 'foreground' && state !== 'background') return;

    const visKey = `${user.sub}:${roomId}`;
    userVisibility.set(visKey, state);
  });

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
          archiveLog(roomId);
          delete roomUsers[roomId];
          delete roomStartedAt[roomId];
        }
        
        // 部屋の残りのユーザーに退出を通知
        socket.to(roomId).emit('user-disconnected', socket.id);
      }

      // Visibility 状態と roomParticipants のクリーンアップ
      const user = socket.data.user;
      if (user?.sub) {
        userVisibility.delete(`${user.sub}:${roomId}`);
        const participants = roomParticipants.get(roomId);
        if (participants) {
          participants.delete(user.sub);
          if (participants.size === 0) {
            roomParticipants.delete(roomId);
          }
        }
      }
    }
    
    delete socketRoomMap[socket.id];
  });
});

app.get('/', (req, res) => {
  res.send('Signaling Server is running');
});

const PORT = process.env.PORT || 3001;

ensureDirectories();
startScheduler();

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
