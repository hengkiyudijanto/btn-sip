"""Buat src/lib/sip/ranking-gambar.ts berisi gambar sebagai base64.

Gambar ditanam di kode (bukan hanya ditaruh di public/) supaya ikut di dalam
berkas PPTX yang diunduh pengguna. Kalau hanya merujuk berkas di public/,
PPTX yang dibuka di komputer lain akan kehilangan background & logonya.

Ketiga gambar ini diambil dari file asli user (sip.pptx):
  - background-ranking.png  -> ppt/media/image1.png   (2880x1620)
  - logo-danantara.png      -> ppt/media/image2.png   (1301x326, transparan)
  - logo-btn.png            -> ppt/media/image3.png   (437x437, transparan)

Berkasnya besar, jadi dipisah dari ranking-pptx.ts supaya kode tata letak
tetap enak dibaca.
"""

import base64
from pathlib import Path

akar = Path('/home/ubuntu/projects/btn-sip/public')

background = base64.b64encode((akar / 'background-ranking.png').read_bytes()).decode()
danantara = base64.b64encode((akar / 'logo-danantara.png').read_bytes()).decode()
btn = base64.b64encode((akar / 'logo-btn-mark.png').read_bytes()).decode()

isi = f'''/**
 * Gambar untuk slide ranking, ditanam sebagai base64.
 *
 * BERKAS INI DIHASILKAN OTOMATIS oleh scripts/buat-ranking-gambar.py —
 * jangan disunting manual. Untuk mengganti gambar, ganti berkasnya di
 * public/ lalu jalankan ulang skrip itu.
 *
 * Ukuran asli:
 *   BACKGROUND      2880 x 1620 px  (latar biru + pita merah, tanpa logo)
 *   LOGO_DANANTARA  1301 x  326 px  (transparan)
 *   LOGO_BTN         437 x  437 px  (transparan)
 */

/** Latar biru + pita merah. Rasio 16:9 (2880x1620). */
export const BACKGROUND =
  '{background}';

/** Logo Danantara Indonesia, latar transparan. Rasio 1301:326. */
export const LOGO_DANANTARA =
  '{danantara}';

/** Logo btn, latar transparan. Rasio 1:1. */
export const LOGO_BTN =
  '{btn}';
'''

tujuan = Path('/home/ubuntu/projects/btn-sip/src/lib/sip/ranking-gambar.ts')
tujuan.write_text(isi, encoding='utf-8')
print(f'ranking-gambar.ts dibuat: {len(isi)} karakter')
print(f'  background : {len(background)} karakter base64')
print(f'  danantara  : {len(danantara)} karakter base64')
print(f'  btn        : {len(btn)} karakter base64')
