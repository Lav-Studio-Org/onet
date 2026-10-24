# Onet: Sambung Gambar

Game Onet (tile connect) di browser. Ketuk dua gambar yang sama; kalau bisa disambung garis dengan **paling banyak 2 belokan** tanpa menembus gambar lain, keduanya hilang. Garis boleh lewat pinggir luar papan.

**Main:** https://lavaruz.github.io/onet/

## Tingkat kesulitan

Tiap tingkat punya 5 babak. Mulai babak tertentu gambar bergeser setelah dipasangkan (turun, naik, ke kiri, ke kanan, menjauh/merapat ke tengah).

| Tingkat | Papan | Jenis gambar | Waktu babak 1 | Petunjuk / Acak | Pergeseran |
|---|---|---|---|---|---|
| Sangat Mudah | 4 × 6 (24) | 6 | 2:30 | 5 / 5 | tidak ada |
| Mudah | 6 × 8 (48) | 12 | 3:30 | 4 / 3 | babak 4–5 |
| Sedang | 7 × 10 (70) | 18 | 4:30 | 3 / 2 | babak 2–5 |
| Sulit | 8 × 12 (96) | 24 | 5:30 | 2 / 2 | semua babak |
| Sangat Sulit | 9 × 14 (126) | 32 | 6:30 | 1 / 1 | semua babak |

Di layar lebar (desktop) papan otomatis diputar mendatar. Kalau tidak ada pasangan yang bisa disambung, papan diacak gratis.

## Skor

- Tiap pasangan: (10 + 5 × jumlah belokan) × pengali tingkat × combo (pasangan beruntun dalam 3,5 detik).
- Selesai babak: bonus sisa waktu. Bintang 3/2/1 dari sisa waktu (≥50% / ≥25% / sisanya).

## Teknis

- HTML/CSS/JS biasa, tanpa build dan tanpa library. Semua gambar adalah SVG buatan sendiri (`js/tiles.js`), ikon UI di sprite `index.html`.
- `js/board.js`: logika papan murni (jalur 2 belokan, petunjuk, acak, pergeseran). Dites dengan `node scripts/test-board.js` (dibandingkan dengan BFS brute force).
- `js/audio.js`: efek suara & musik disintesis Web Audio.
- `js/ads.js`: semua iklan lewat `ON.Ads`. Placement berhadiah: `hint_refill`, `shuffle_refill`, `time_revive`; interstitial `stage_end` (dibatasi). Versi web memakai iklan contoh untuk hadiah dan tidak menampilkan interstitial. Untuk APK nanti cukup sediakan `ON.nativeAdProvider` (AdMob via Capacitor).
- PWA: bisa di-install dan dimainkan offline (`sw.js`).
- Deploy: `.github/workflows/pages.yml` menyalin `main` ke branch `gh-pages` yang disajikan GitHub Pages.

Tes browser lokal:

```sh
python3 -m http.server 8123 &
node scripts/smoke.js http://localhost:8123/ /tmp/shots
```
