# Design Direction: Industrial Field Utility

Dial: ENERGY 1 / RHYTHM 2 / MOTION 1

## Target Pengguna & Konteks
Petugas inspeksi pompa di blok kebun PT TH Indoplantation (ponsel di bawah sinar matahari) serta Admin dan manajer operasional di kantor (desktop, fokus rekap & cetak laporan).

## Palet Warna (Maksimal 2 Inti + 1 Aksen + Netral)
- Permukaan dasar lapangan: `#F7F8F5` (warm limestone off-white, mengurangi silau luar ruang)
- Permukaan kartu/tabel: `#FFFFFF` dengan garis tepi `#D5DDD7`
- Teks utama & navigasi: `#132019` (rasio 15.78:1 terhadap `#F7F8F5`, WCAG AA PASS)
- Teks sekunder & label: `#47554D` (rasio 7.85:1 terhadap `#FFFFFF`, WCAG AA PASS)
- Aksen tunggal terarah: `#15803D` dengan teks `#FFFFFF` (rasio 5.02:1, WCAG AA PASS), dipakai khusus pada tombol aksi utama dan penanda navigasi aktif.
- Status operasional (selalu berpasangan dengan teks + ikon, bukan warna saja):
  - Aktif: `#166534` di atas `#DCFCE7` (6.49:1)
  - Perlu Perbaikan: `#92400E` di atas `#FEF3C7` (6.37:1)
  - Rusak Total: `#991B1B` di atas `#FEE2E2` (6.80:1)

## Tipografi
- UI & formulir: `Plus Jakarta Sans` (keterbacaan tinggi di layar kecil dan kondisi luar ruang).
- Kode unit & angka tabular: `JetBrains Mono` dengan `font-variant-numeric: tabular-nums` khusus untuk `Kode Pompa`, `Kode Block`, dan kolom kuantitas laporan.

## Tata Letak, Tap Target & Gerak
- Mobile (`< 768px`): bottom navigation tetap dengan `pb-24` agar konten terakhir dapat dijangkau, semua tombol & pill checklist minimal `44px x 44px`, tanpa horizontal overflow.
- Tablet (`768px - 1023px`) & Desktop (`>= 1024px`): sidebar dengan tombol collapse (`aria-expanded`), penanda aktif berupa bentuk + warna + ketebalan huruf.
- Gerak: `MOTION 1`, transisi hover/active ringan saja tanpa animasi berulang atau floating dekoratif, mematuhi `prefers-reduced-motion`.
