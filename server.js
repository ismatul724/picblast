const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const {
  getThemesWithQuestions,
  createSession,
  finishSession,
  saveSessionPlayers,
  getRecentSessions
} = require('./db');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ ok: true, app: 'PicBlast', time: new Date().toISOString() });
});

app.get('/api/sessions', (req, res) => {
  res.json(getRecentSessions(20));
});

const rooms = new Map();

function roomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return rooms.has(code) ? roomCode() : code;
}

function normalize(text = '') {
  return text.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '');
}

function makePlayer(socketId, name, isHost = false, fixed = null) {
  const avatars = ['?', '?', '?', '?', '?'];
  const colors = ['#5eead4', '#f472b6', '#facc15', '#60a5fa', '#c084fc'];
  const idx = Math.floor(Math.random() * avatars.length);
  return {
    id: fixed?.id || 'pl_' + Math.random().toString(36).slice(2, 10),
    socketId,
    name,
    isHost,
    avatar: fixed?.avatar || avatars[idx],
    color: fixed?.color || colors[idx],
    score: 0,
    roundScore: 0,
    answersMs: [],
    freezeCharges: 0,
    connected: true,
    frozenForQuestion: false,
    submittedThisQuestion: false,
    lastAnswerMs: null
  };
}

function publicPlayer(player) {
  return {
    id: player.id,
    name: player.name,
    avatar: player.avatar,
    color: player.color,
    score: player.score,
    roundScore: player.roundScore,
    avgAnswerMs: player.answersMs.length ? Math.round(player.answersMs.reduce((a, b) => a + b, 0) / player.answersMs.length) : null,
    freezeCharges: player.freezeCharges || 0,
    connected: player.connected
  };
}

function getLeaderboard(room) {
  return [...room.players]
    .map(publicPlayer)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if ((a.avgAnswerMs ?? Infinity) !== (b.avgAnswerMs ?? Infinity)) return (a.avgAnswerMs ?? Infinity) - (b.avgAnswerMs ?? Infinity);
      return a.name.localeCompare(b.name);
    });
}

function emitRoomState(room) {
  io.to(room.code).emit('room:state', {
    code: room.code,
    status: room.status,
    players: room.players.map(publicPlayer),
    selectedThemes: room.selectedThemes,
    leaderboard: getLeaderboard(room)
  });
}

function createRoom(hostName) {
  const code = roomCode();
  const themes = getThemesWithQuestions();
  const room = {
    code,
    hostSocketId: null,
    status: 'lobby',
    createdAt: Date.now(),
    sessionId: null,
    players: [],
    selectedThemes: themes.map(t => t.id),
    rounds: themes,
    currentRoundIndex: 0,
    currentQuestionIndex: 0,
    questionStartedAt: null,
    questionDurationMs: 20000,
    revealStepMs: 1000,
    freezeOwnerPlayerId: null,
    pendingFreezeTargetId: null,
    freezeConsumedThisRound: false,
    questionResolved: false,
    questionTimer: null,
    revealTimer: null,
    revealLevel: 0,
    hostName
  };
  rooms.set(code, room);
  return room;
}

function refreshRounds(room) {
  room.rounds = getThemesWithQuestions(room.selectedThemes);
}

function currentRound(room) {
  return room.rounds[room.currentRoundIndex];
}

function currentQuestion(room) {
  const round = currentRound(room);
  return round?.questions[room.currentQuestionIndex];
}

function resetQuestionFlags(room) {
  room.players.forEach(p => {
    p.submittedThisQuestion = false;
    p.frozenForQuestion = room.pendingFreezeTargetId === p.id;
    p.lastAnswerMs = null;
  });
}

function emitQuestion(room) {
  const round = currentRound(room);
  const question = currentQuestion(room);
  if (!round || !question) return;
  room.questionResolved = false;
  room.questionStartedAt = Date.now();
  room.revealLevel = 0;
  resetQuestionFlags(room);
  io.to(room.code).emit('question:start', {
    roundIndex: room.currentRoundIndex,
    roundName: round.name,
    roundIcon: round.icon,
    totalRounds: room.rounds.length,
    questionIndex: room.currentQuestionIndex,
    totalQuestions: round.questions.length,
    clue: question.clues[0],
    imageUrl: question.imageUrl,
    extraClues: question.clues.slice(1),
    art: question.art,
    durationMs: room.questionDurationMs,
    frozenPlayerId: room.pendingFreezeTargetId,
    leaderboard: getLeaderboard(room)
  });

  clearInterval(room.revealTimer);
  room.revealTimer = setInterval(() => {
    room.revealLevel += 1;
    io.to(room.code).emit('question:reveal', { level: room.revealLevel });
  }, room.revealStepMs);

  clearTimeout(room.questionTimer);
  room.questionTimer = setTimeout(() => finishQuestion(room.code, null), room.questionDurationMs);
}

function finishQuestion(code, winnerPlayerId) {
  const room = rooms.get(code);
  if (!room || room.questionResolved) return;
  room.questionResolved = true;
  clearInterval(room.revealTimer);
  clearTimeout(room.questionTimer);
  const question = currentQuestion(room);
  const winner = room.players.find(p => p.id === winnerPlayerId) || null;
  io.to(room.code).emit('question:end', {
    answer: question.answer,
    winner: winner ? publicPlayer(winner) : null,
    leaderboard: getLeaderboard(room)
  });
  room.pendingFreezeTargetId = null;

  setTimeout(() => {
    const round = currentRound(room);
    if (!round) return;
    if (room.currentQuestionIndex < round.questions.length - 1) {
      room.currentQuestionIndex += 1;
      emitQuestion(room);
    } else {
      finishRound(room.code);
    }
  }, 3000);
}

function finishRound(code) {
  const room = rooms.get(code);
  if (!room) return;
  const rankedRound = [...room.players].sort((a, b) => b.roundScore - a.roundScore);
  const roundWinner = rankedRound[0] || null;
  if (roundWinner && room.currentRoundIndex < room.rounds.length - 1) {
    roundWinner.freezeCharges += 1;
    room.freezeOwnerPlayerId = roundWinner.id;
  }
  io.to(room.code).emit('round:end', {
    roundIndex: room.currentRoundIndex,
    roundName: currentRound(room)?.name,
    winner: roundWinner ? publicPlayer(roundWinner) : null,
    leaderboard: getLeaderboard(room)
  });

  setTimeout(() => {
    if (room.currentRoundIndex < room.rounds.length - 1) {
      room.currentRoundIndex += 1;
      room.currentQuestionIndex = 0;
      room.freezeConsumedThisRound = false;
      room.players.forEach(p => { p.roundScore = 0; p.frozenForQuestion = false; p.submittedThisQuestion = false; });
      emitQuestion(room);
    } else {
      finishGame(room.code);
    }
  }, 4500);
}

function finishGame(code) {
  const room = rooms.get(code);
  if (!room) return;
  room.status = 'finished';
  const leaderboard = getLeaderboard(room);
  if (room.sessionId) {
    saveSessionPlayers(room.sessionId, leaderboard);
    finishSession(room.sessionId, 'finished');
  }
  io.to(room.code).emit('game:end', { leaderboard });
}

io.on('connection', socket => {
  socket.on('room:create', ({ hostName }) => {
    const safeName = (hostName || 'Host').slice(0, 18);
    const room = createRoom(safeName);
    const host = makePlayer(socket.id, safeName, true);
    room.hostSocketId = socket.id;
    room.players.push(host);
    socket.join(room.code);
    socket.data.roomCode = room.code;
    socket.data.playerId = host.id;
    socket.emit('room:created', { code: room.code, player: publicPlayer(host), themes: room.rounds.map(t => ({ id: t.id, name: t.name, icon: t.icon })) });
    emitRoomState(room);
  });

  socket.on('room:join', ({ code, playerName }) => {
    const room = rooms.get((code || '').toUpperCase());
    if (!room) return socket.emit('error:message', { message: 'Room tidak ditemukan.' });
    if (room.players.length >= 5) return socket.emit('error:message', { message: 'Room sudah penuh.' });
    if (room.status !== 'lobby') return socket.emit('error:message', { message: 'Game sudah dimulai.' });
    const player = makePlayer(socket.id, (playerName || 'Pemain').slice(0, 18));
    room.players.push(player);
    socket.join(room.code);
    socket.data.roomCode = room.code;
    socket.data.playerId = player.id;
    socket.emit('room:joined', { code: room.code, player: publicPlayer(player), themes: room.rounds.map(t => ({ id: t.id, name: t.name, icon: t.icon })) });
    emitRoomState(room);
  });

  socket.on('themes:update', ({ code, themeIds }) => {
    const room = rooms.get((code || '').toUpperCase());
    if (!room || room.hostSocketId !== socket.id || room.status !== 'lobby') return;
    room.selectedThemes = themeIds?.length ? themeIds : room.selectedThemes;
    refreshRounds(room);
    emitRoomState(room);
  });

  socket.on('game:start', ({ code }) => {
    const room = rooms.get((code || '').toUpperCase());
    if (!room || room.hostSocketId !== socket.id) return;
    if (room.selectedThemes.length === 0) return socket.emit('error:message', { message: 'Pilih minimal 1 tema.' });
    room.status = 'playing';
    room.currentRoundIndex = 0;
    room.currentQuestionIndex = 0;
    room.freezeConsumedThisRound = false;
    room.pendingFreezeTargetId = null;
    room.sessionId = createSession(room.code);
    room.players.forEach(p => {
      p.score = 0; p.roundScore = 0; p.answersMs = []; p.freezeCharges = 0; p.frozenForQuestion = false; p.submittedThisQuestion = false; p.lastAnswerMs = null;
    });
    refreshRounds(room);
    emitRoomState(room);
    emitQuestion(room);
  });

  socket.on('freeze:use', ({ code, targetPlayerId }) => {
    const room = rooms.get((code || '').toUpperCase());
    if (!room || room.status !== 'playing') return;
    const actor = room.players.find(p => p.socketId === socket.id);
    if (!actor || actor.freezeCharges < 1 || room.freezeConsumedThisRound) return;
    if (actor.id === targetPlayerId) return;
    room.pendingFreezeTargetId = targetPlayerId;
    room.freezeConsumedThisRound = true;
    actor.freezeCharges -= 1;
    io.to(room.code).emit('freeze:armed', {
      byPlayerId: actor.id,
      targetPlayerId,
      leaderboard: getLeaderboard(room)
    });
  });

  socket.on('answer:submit', ({ code, answer }) => {
    const room = rooms.get((code || '').toUpperCase());
    if (!room || room.status !== 'playing' || room.questionResolved) return;
    const player = room.players.find(p => p.socketId === socket.id);
    const question = currentQuestion(room);
    if (!player || !question) return;
    if (player.frozenForQuestion) return socket.emit('answer:feedback', { ok: false, message: 'Kamu sedang terkena freeze untuk soal ini.' });
    if (player.submittedThisQuestion) return socket.emit('answer:feedback', { ok: false, message: 'Kamu sudah menjawab di soal ini.' });

    player.submittedThisQuestion = true;
    const normalized = normalize(answer);
    const ok = question.accepted.some(a => normalize(a) === normalized);
    if (!ok) return socket.emit('answer:feedback', { ok: false, message: 'Jawaban belum tepat.' });

    const elapsed = Date.now() - room.questionStartedAt;
    const base = 120;
    const speedPenalty = Math.floor(elapsed / 250);
    const points = Math.max(25, base - speedPenalty);
    player.score += points;
    player.roundScore += points;
    player.answersMs.push(elapsed);
    player.lastAnswerMs = elapsed;
    socket.emit('answer:feedback', { ok: true, message: `Benar! +${points} poin` });
    io.to(room.code).emit('leaderboard:update', { leaderboard: getLeaderboard(room), latestWinnerId: player.id, points });
    finishQuestion(room.code, player.id);
  });

  socket.on('disconnect', () => {
    const code = socket.data.roomCode;
    if (!code || !rooms.has(code)) return;
    const room = rooms.get(code);
    const player = room.players.find(p => p.socketId === socket.id);
    if (player) player.connected = false;
    emitRoomState(room);
  });
});

server.listen(PORT, () => {
  console.log(`PicBlast berjalan di http://localhost:${PORT}`);
  console.log(`Host:   http://localhost:${PORT}/host.html`);
  console.log(`Player: http://localhost:${PORT}/player.html`);
});

