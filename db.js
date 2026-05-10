const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, 'picblast.sqlite');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS themes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  theme_id TEXT NOT NULL,
  answer TEXT NOT NULL,
  accepted TEXT NOT NULL,
  clues TEXT NOT NULL,
  image_url TEXT NOT NULL,
  FOREIGN KEY(theme_id) REFERENCES themes(id)
);
CREATE TABLE IF NOT EXISTS game_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_code TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  status TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS game_players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  player_name TEXT NOT NULL,
  total_score INTEGER NOT NULL DEFAULT 0,
  avg_answer_ms INTEGER,
  final_rank INTEGER,
  FOREIGN KEY(session_id) REFERENCES game_sessions(id)
);
`);

function seedIfEmpty() {
  const themeCount = db.prepare('SELECT COUNT(*) AS c FROM themes').get().c;
  if (themeCount > 0) return;

  const themes = [
    ['hardware', 'Perangkat Keras', '???'],
    ['network', 'Jaringan', '??'],
    ['programming', 'Pemrograman', '??']
  ];
  const insertTheme = db.prepare('INSERT INTO themes (id, name, icon) VALUES (?, ?, ?)');
  themes.forEach(t => insertTheme.run(...t));

const rows = [
  ['hardware','CPU', JSON.stringify(['cpu','processor','prosesor','central processing unit']), JSON.stringify(['Komponen inti pemrosesan komputer','Terpasang langsung di motherboard','Kinerjanya diukur dalam GHz']), '/images/cpu.jpg'],
  ['hardware','RAM', JSON.stringify(['ram','random access memory','memori ram']), JSON.stringify(['Penyimpanan sementara saat komputer aktif','Berbentuk modul panjang dan tipis','Kapasitasnya diukur dalam GB']), '/images/ram.jpg'],
  ['hardware','Mouse', JSON.stringify(['mouse','tetikus','maus']), JSON.stringify(['Alat input untuk menggerakkan kursor','Punya tombol klik kiri dan kanan','Sering dipakai bersama keyboard']), '/images/mouse.jpg'],
  ['hardware','Keyboard', JSON.stringify(['keyboard','papan ketik','kibor']), JSON.stringify(['Alat input utama untuk mengetik','Memiliki banyak tombol huruf dan angka','Ada versi wired dan wireless']), '/images/keyboard.jpg'],
  ['hardware','Monitor', JSON.stringify(['monitor','layar','display','screen']), JSON.stringify(['Perangkat output untuk menampilkan gambar','Ukurannya diukur dalam inci','Ada jenis LCD dan LED']), '/images/monitor.jpg'],
  ['network','Router', JSON.stringify(['router','ruter']), JSON.stringify(['Mengarahkan lalu lintas data antar jaringan','Perangkat rumahan biasanya punya antena','Menghubungkan perangkat ke internet']), '/images/router.jpg'],
  ['network','Switch', JSON.stringify(['switch','network switch','swit']), JSON.stringify(['Menghubungkan banyak perangkat dalam satu jaringan lokal','Memiliki banyak port ethernet','Berbeda dengan hub, lebih cerdas']), '/images/switch.jpg'],
  ['network','Kabel UTP', JSON.stringify(['utp','kabel utp','unshielded twisted pair','kabel lan','lan cable']), JSON.stringify(['Kabel jaringan yang sering dipakai di kantor','Ujungnya menggunakan konektor RJ-45','Tersedia dalam beberapa kategori seperti Cat5 dan Cat6']), '/images/kabel-utp.jpg'],
  ['network','Firewall', JSON.stringify(['firewall','fire wall','tembok api']), JSON.stringify(['Sistem keamanan jaringan','Memfilter lalu lintas data masuk dan keluar','Bisa berupa perangkat keras atau lunak']), '/images/firewall.jpg'],
  ['programming','Python', JSON.stringify(['python','paiton']), JSON.stringify(['Bahasa pemrograman tingkat tinggi','Banyak dipakai untuk AI dan data science','Namanya terinspirasi dari acara komedi Inggris']), '/images/python.jpg'],
  ['programming','JavaScript', JSON.stringify(['javascript','js','java script']), JSON.stringify(['Bahasa pemrograman utama untuk web browser','Bisa berjalan di frontend maupun backend','Sering disingkat dua huruf saja']), '/images/javascript.jpg'],
  ['programming','Database', JSON.stringify(['database','basis data','db','data base']), JSON.stringify(['Sistem untuk menyimpan dan mengelola data','Diakses menggunakan bahasa query','Contohnya MySQL dan PostgreSQL']), '/images/database.jpg']
];
  rows.forEach(r => insertQ.run(...r));
}

function getThemesWithQuestions(selectedThemeIds = null) {
  const themes = selectedThemeIds?.length
    ? db.prepare(`SELECT * FROM themes WHERE id IN (${selectedThemeIds.map(() => '?').join(',')})`).all(...selectedThemeIds)
    : db.prepare('SELECT * FROM themes').all();
  const getQuestions = db.prepare('SELECT * FROM questions WHERE theme_id = ? ORDER BY id');
  return themes.map(t => ({
    id: t.id, name: t.name, icon: t.icon,
    questions: getQuestions.all(t.id).map(q => ({
      id: q.id, answer: q.answer,
      accepted: JSON.parse(q.accepted),
      clues: JSON.parse(q.clues),
      imageUrl: q.image_url
    }))
  }));
}

function createSession(roomCode) {
  const now = new Date().toISOString();
  const result = db.prepare("INSERT INTO game_sessions (room_code, started_at, status) VALUES (?, ?, ?)").run(roomCode, now, 'playing');
  return result.lastInsertRowid;
}

function finishSession(sessionId, status = 'finished') {
  const now = new Date().toISOString();
  db.prepare("UPDATE game_sessions SET finished_at = ?, status = ? WHERE id = ?").run(now, status, sessionId);
}

function saveSessionPlayers(sessionId, leaderboard) {
  const stmt = db.prepare('INSERT INTO game_players (session_id, player_name, total_score, avg_answer_ms, final_rank) VALUES (?, ?, ?, ?, ?)');
  const insertMany = db.transaction(rows => rows.forEach(r => stmt.run(sessionId, r.name, r.score, r.avgAnswerMs, r.rank)));
  insertMany(leaderboard.map((p, i) => ({ ...p, rank: i + 1 })));
}

function getRecentSessions(limit = 10) {
  return db.prepare('SELECT * FROM game_sessions ORDER BY id DESC LIMIT ?').all(limit);
}

seedIfEmpty();
module.exports = { db, getThemesWithQuestions, createSession, finishSession, saveSessionPlayers, getRecentSessions };
