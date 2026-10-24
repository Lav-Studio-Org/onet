# Audit UI/UX Onet v1.0

Sudut pandang: senior UI/UX designer, fokus HP (layar 360–430 px), juga dicek di desktop 1366 px.
Bahan: screenshot semua layar dari `scripts/smoke.js` (menu, main di 5 tingkat, pilih/petunjuk, babak selesai, waktu habis, iklan, isi ulang, jeda, pengaturan, cara main).

## Kesan pertama
Gaya visualnya sudah kuat dan konsisten: ubin krem bergaya mahjong, 38 gambar SVG satu keluarga, tema hijau toska yang tenang, tanpa emoji. Masalah terbesar bukan di tampilan, tapi di **informasi saat bermain**: aturan geser gambar hanya muncul sekilas, dan pesan babak menutupi timer tepat saat waktu mulai berjalan.

## Usability

| Temuan | Tingkat | Rekomendasi |
|---|---|---|
| Pesan "Babak 1: Gambar bergeser ke kiri" muncul sebagai toast di atas dock, **menutupi timer** selama 2 detik pertama, dan waktunya sudah berjalan. | Kritis | Ganti dengan banner pembuka babak di tengah papan (nomor babak, ikon arah, penjelasan). Timer baru jalan setelah banner hilang. |
| Aturan geser hanya dijelaskan sekali. Di tengah babak pemain lupa arahnya dan merasa gambar "lompat sendiri". | Kritis | Chip arah geser permanen di HUD (ikon panah + teks pendek) selama babak itu. |
| Waktu ditampilkan dua kali (bar di HUD + angka di dock). Mata harus bolak-balik atas–bawah. | Sedang | Satukan: angka waktu di samping bar di HUD. Tengah dock dipakai untuk progres "sisa pasangan". |
| Tidak ada indikator progres papan. Di papan 126 gambar pemain tidak tahu sudah sejauh apa. | Sedang | Penghitung "Sisa N pasang" di tengah dock, juga dipakai di layar waktu habis. |
| Memilih dua gambar sama yang jalurnya terhalang hanya memberi efek getar. Pemain baru tidak paham kenapa gagal. | Sedang | Pesan singkat "Jalurnya terhalang, cari jalan dengan maksimal 2 belokan" untuk 3 kejadian pertama. |
| Setiap main harus mulai dari babak 1 lagi meski sudah tamat babak 3. | Sedang | Saat memilih tingkat yang sudah ada progresnya, tawarkan "Lanjut babak N" atau "Mulai dari babak 1". |
| Layar "Waktu habis": tombol kedua bertuliskan "Selesai", ambigu (selesai apa?). Tidak ada gambaran seberapa dekat pemain dengan menang. | Kecil | Tombol "Lihat hasil", plus bar progres "28 dari 48 gambar sudah dipasangkan". |
| Bintang di layar babak selesai tidak dijelaskan. | Kecil | Teks kecil: "Makin cepat selesai, makin banyak bintang". |

## Hierarki visual
- **Yang pertama dilihat:** papan ubin. Benar, itu fokus utama.
- **Alur baca:** HUD (tingkat, babak, waktu) → papan → tombol bantuan. Sudah natural setelah waktu dipindah ke HUD.
- **Penekanan:** skor emas paling mencolok di HUD padahal yang paling penting saat bermain adalah waktu. Angka waktu diberi bobot setara skor dan berubah merah saat tinggal 15 detik.
- **Menu utama:** kartu tingkat menampilkan "Terbaik 0" dan 5 bintang abu-abu untuk pemain baru, sehingga terkesan kosong/kalah. Ganti dengan "Belum dimainkan", dan bintang diganti progres babak (5 segmen) yang punya label jelas "Babak 2/5".
- **Meta kartu tingkat:** "24 gambar" kurang membantu memilih. Tambah ukuran papan dan waktu (mis. "4×6 · 2:30"), plus tanda bila ada babak geser.

## Konsistensi

| Elemen | Masalah | Rekomendasi |
|---|---|---|
| Notifikasi | Toast dipakai untuk info babak, hadiah, dan acak otomatis sekaligus. | Toast hanya untuk info singkat. Info babak pakai banner khusus. |
| Warna aksi | Sudah konsisten: hijau + ikon video = iklan berhadiah, oranye = aksi utama, emas = skor/petunjuk. | Pertahankan, dokumentasikan. |
| Perayaan | Babak selesai ada bintang, tapi tamat tingkat dan rekor baru tidak ada perayaan visual. | Konfeti ringan (CSS, tanpa gambar) saat tamat dan rekor baru. |

## Aksesibilitas
- **Kontras:** teks krem di toska tua (≈ 10:1) dan teks gelap di kartu krem (≈ 14:1) lolos AA. Label "SKOR" (opacity .7) ≈ 5.6:1, masih lolos.
- **Ukuran sentuh:** tombol 44–50 px lolos. Ubin Sangat Sulit di HP 360 px sekitar 34×40 px, di bawah 44 px tapi wajar untuk genre ini (papan 9×14). Tidak diperkecil lagi.
- **Gerak:** animasi goyang/denyut dimatikan bila `prefers-reduced-motion`. Banner dan konfeti baru juga ikut aturan ini.
- **Label:** ubin punya `aria-label` nama gambar. Banner babak diberi `aria-live`.

## Yang sudah bagus
- Set ikon dan ubin buatan sendiri, konsisten, tanpa emoji.
- Garis sambungan dengan glow dan titik belok membuat aturan "2 belokan" terlihat jelas.
- Tombol bantuan yang habis berubah jadi lencana hijau video, jelas tanpa teks tambahan.
- Papan otomatis mendatar di desktop.

## Prioritas yang diterapkan
1. **Banner pembuka babak + timer menunggu** — menghilangkan detik yang "dicuri" dan menjelaskan aturan geser dengan ikon.
2. **Chip arah geser permanen + waktu di HUD + sisa pasangan di dock** — informasi penting selalu terlihat di satu tempat.
3. **Lanjut babak, menu yang tidak terkesan kosong, pesan jalur terhalang, layar waktu habis yang informatif, konfeti** — memperhalus alur dari pemain baru sampai pemain yang mengulang.
