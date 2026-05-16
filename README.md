# PicBlast

PicBlast adalah game tebak gambar multiplayer realtime berbasis web yang dirancang untuk menghadirkan pengalaman bermain kompetitif, interaktif, dan edukatif. Aplikasi ini menampilkan gambar secara bertahap dari blur ke jelas, dilengkapi sistem skor berbasis kecepatan, fitur freeze, clue otomatis, dan leaderboard live.[1]

## Demo

Aplikasi dapat diakses pada deployment berikut: [PicBlast Live Demo](https://picblast-production.up.railway.app).[2]

## Fitur Utama

- Multiplayer realtime berbasis Socket.IO untuk sinkronisasi permainan antar pemain dalam satu sesi.[1]
- Progressive image, yaitu gambar tampil bertahap dari blur hingga jelas untuk meningkatkan tantangan.[1]
- Sistem skor berbasis kecepatan, sehingga pemain yang menjawab lebih cepat memperoleh poin lebih tinggi.[1]
- Fitur freeze sebagai elemen strategi bagi pemain dengan skor tertinggi pada babak sebelumnya.[1]
- Clue otomatis untuk membantu pemain mengidentifikasi jawaban.[1]
- Leaderboard realtime yang diperbarui langsung tanpa refresh halaman.[1]
- Penyimpanan data sesi dan skor menggunakan SQLite.[1]

## Teknologi yang Digunakan

| Komponen | Teknologi | Fungsi |
|---|---|---|
| Runtime server | Node.js | Menjalankan logika server.[1] |
| Web framework | Express.js | Routing HTTP dan penyajian file statis.[1] |
| Realtime communication | Socket.IO | Sinkronisasi event multiplayer.[1] |
| Database | SQLite + better-sqlite3 | Menyimpan tema, soal, sesi, dan skor.[1] |
| Frontend | HTML, CSS, JavaScript | Antarmuka host dan pemain.[1] |
| Rendering gambar | HTML5 Canvas + CSS filter | Menampilkan efek progressive image.[1] |

## Alur Singkat Permainan

1. Host membuat sesi permainan dan sistem menghasilkan kode room.[1]
2. Pemain memasukkan nama dan kode room untuk bergabung ke sesi.[1]
3. Host memilih tema dan memulai permainan.[1]
4. Sistem menampilkan soal, gambar progresif, clue, serta timer secara realtime kepada semua pemain.[1]
5. Pemain mengirim jawaban, lalu sistem memvalidasi dan memperbarui skor serta leaderboard.[1]
6. Di akhir babak, pemain terbaik dapat memperoleh hak menggunakan freeze pada soal berikutnya.[1]
7. Setelah permainan selesai, sistem menampilkan hasil akhir dan menyimpan data sesi.[1]

## Peran Pengguna

### Host
- Membuat sesi permainan.[1]
- Melihat kode room.[1]
- Memilih tema permainan.[1]
- Melihat daftar pemain di lobby secara realtime.[1]
- Memulai dan mengakhiri permainan.[1]

### Pemain
- Bergabung ke room menggunakan nama dan kode sesi.[1]
- Menunggu permainan dimulai di lobby.[1]
- Menjawab soal berdasarkan gambar progresif dan clue.[1]
- Melihat skor dan leaderboard realtime.[1]
- Menggunakan fitur freeze bila tersedia.[1]
- Melihat hasil akhir permainan.[1]

## Struktur Fitur Realtime

Beberapa event utama Socket.IO yang digunakan dalam sistem meliputi `create-session`, `join-session`, `player-joined`, `start-game`, `new-question`, `timer-update`, `image-update`, `submit-answer`, `score-update`, `freeze-awarded`, `use-freeze`, `player-frozen`, `round-end`, dan `game-end`.[1]

## Tujuan Pengembangan

PicBlast dikembangkan sebagai game edukasi berbasis web yang memadukan hiburan, kecepatan berpikir, ketelitian visual, dan strategi dalam satu platform multiplayer realtime.[1]

## Catatan

README ini disusun berdasarkan dokumen laporan proyek yang menjelaskan arsitektur, fitur, alur sistem, dan implementasi PicBlast.[1]
