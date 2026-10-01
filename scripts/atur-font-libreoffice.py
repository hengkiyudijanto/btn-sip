"""Buat aturan penggantian font untuk LibreOffice.

Server ini tidak punya font Aptos (milik Microsoft, tidak boleh disebarkan).
Saat merender PPTX untuk pemeriksaan, LibreOffice akan memakai font apa pun
yang tersedia — hasilnya bisa jauh berbeda dan menyesatkan.

Carlito dipakai sebagai pengganti: metriknya mirip font sans-serif Office
modern, jadi lebar teks di pratinjau mendekati aslinya.

PENTING: ini hanya mempengaruhi PRATINJAU di server. Berkas PPTX yang
diunduh user tetap berisi nama font "Aptos", dan akan dirender dengan Aptos
asli di komputer yang punya Microsoft Office versi baru.
"""

from pathlib import Path

konfig = Path.home() / '.config' / 'libreoffice' / '4' / 'user'
konfig.mkdir(parents=True, exist_ok=True)

# LibreOffice: daftar penggantian font di registrymodifications.xcu
xcu = konfig / 'registrymodifications.xcu'

entri = """<?xml version="1.0" encoding="UTF-8"?>
<oor:items xmlns:oor="http://openoffice.org/2001/registry"
           xmlns:xs="http://www.w3.org/2001/XMLSchema"
           xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
 <item oor:path="/org.openoffice.Office.Common/Font/Substitution">
  <prop oor:name="Aptos" oor:op="fuse">
   <value>Carlito</value>
  </prop>
 </item>
 <item oor:path="/org.openoffice.Office.Common/Font/Substitution">
  <prop oor:name="Aptos Display" oor:op="fuse">
   <value>Carlito</value>
  </prop>
 </item>
 <item oor:path="/org.openoffice.Office.Common/Font/Substitution">
  <prop oor:name="Calibri" oor:op="fuse">
   <value>Carlito</value>
  </prop>
 </item>
</oor:items>
"""

# kalau registrymodifications sudah ada, tambahkan; kalau belum, buat baru
if xcu.exists():
    isi = xcu.read_text(encoding='utf-8')
    if 'Aptos' not in isi:
        # sisipkan entri sebelum penutup
        isi = isi.replace('</oor:items>', entri.replace(
            '<?xml version="1.0" encoding="UTF-8"?>', '').replace(
            '<oor:items xmlns:oor="http://openoffice.org/2001/registry"\n           '
            'xmlns:xs="http://www.w3.org/2001/XMLSchema"\n           '
            'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">', ''))
        xcu.write_text(isi, encoding='utf-8')
        print('entri penggantian font ditambahkan ke registrymodifications.xcu')
    else:
        print('entri Aptos sudah ada')
else:
    xcu.write_text(entri, encoding='utf-8')
    print(f'registrymodifications.xcu dibuat di {xcu}')

print(f'\nlokasi: {xcu}')
