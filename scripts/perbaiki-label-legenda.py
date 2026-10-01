"""Perbaiki label SKALA PENILAIAN yang tertutup panel putih.

Masalahnya: label ditempatkan MENIMPA tepi atas panel putih (y = y0 - 0,19
sedangkan panel mulai di y0). Karena panel putih digambar setelah label,
label-nya tertutup.

Solusi paling andal: JANGAN menimpakan label ke panel. Taruh label
seluruhnya DI ATAS panel (tidak menyentuh panel sama sekali), sehingga
urutan gambar tidak lagi menentukan hasilnya.
"""

from pathlib import Path

p = Path('/home/ubuntu/projects/btn-sip/src/lib/sip/ranking-pptx.ts')
s = p.read_text()

lama = """  // URUTAN PENTING: panel putih digambar LEBIH DULU, label biru
  // "SKALA PENILAIAN" digambar SETELAHNYA supaya tidak tertutup panel.
  slide.addShape('roundRect', {
    x: x0, y: y0, w: wPanel, h: hPanel,
    fill: { color: PUTIH }, line: { color: PUTIH, width: 0 },
    rectRadius: 0.06,
  });

  slide.addShape('roundRect', {
    x: x0 + wPanel / 2 - 0.95, y: y0 - 0.19, w: 1.9, h: 0.30,
    fill: { type: 'none' } as never,
    line: { color: PUTIH, width: 1 }, rectRadius: 0.10,
  });
  slide.addText('SKALA PENILAIAN', {
    x: x0 + wPanel / 2 - 0.95, y: y0 - 0.19, w: 1.9, h: 0.30,
    fontSize: 10, bold: true, color: PUTIH, align: 'center',
    valign: 'middle', fontFace: FONT,
  });"""

baru = """  // Panel putih legenda (isi daftar kategori ada di dalamnya).
  slide.addShape('roundRect', {
    x: x0, y: y0, w: wPanel, h: hPanel,
    fill: { color: PUTIH }, line: { color: PUTIH, width: 0 },
    rectRadius: 0.06,
  });

  // Label "SKALA PENILAIAN" diletakkan SELURUHNYA DI ATAS panel (tidak
  // menimpa tepinya). Sebelumnya label ditempatkan menimpa tepi atas panel,
  // dan karena panel digambar belakangan labelnya tertutup.
  slide.addShape('roundRect', {
    x: x0 + wPanel / 2 - 0.95, y: y0 - 0.42, w: 1.9, h: 0.28,
    fill: { type: 'none' } as never,
    line: { color: PUTIH, width: 1 }, rectRadius: 0.12,
  });
  slide.addText('SKALA PENILAIAN', {
    x: x0 + wPanel / 2 - 0.95, y: y0 - 0.42, w: 1.9, h: 0.28,
    fontSize: 10, bold: true, color: PUTIH, align: 'center',
    valign: 'middle', fontFace: FONT,
  });"""

if lama in s:
    s = s.replace(lama, baru)
    p.write_text(s)
    print('label SKALA PENILAIAN dipindah ke atas panel')
else:
    print('POLA tidak ketemu')
