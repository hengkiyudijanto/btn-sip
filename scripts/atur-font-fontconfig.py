"""Agar LibreOffice memakai Carlito saat diminta font "Aptos".

Dua lapis, karena LibreOffice tidak selalu membaca daftar penggantian di
registrymodifications.xcu pada versi headless:

  1. fontconfig: aturan <match> yang memetakan "Aptos" -> "Carlito".
     Ini yang paling andal karena dipakai semua aplikasi Linux.
  2. Salinan Carlito bernama "Aptos" — tidak dilakukan, karena membuat
     font palsu bernama Aptos bisa membingungkan saat berkas dikirim ke
     orang lain.

Tujuan hanya untuk PRATINJAU di server. Berkas PPTX yang diunduh user tetap
berisi nama "Aptos" dan dirender dengan Aptos asli di Microsoft Office.
"""

from pathlib import Path

konfig = Path.home() / '.config' / 'fontconfig' / 'fonts.conf'
konfig.parent.mkdir(parents=True, exist_ok=True)

isi = """<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <!-- Server ini tidak punya font Aptos (milik Microsoft). Saat PPTX yang
       memakai "Aptos" dirender, pakai Carlito supaya pratinjau mendekati
       tampilan aslinya (metrik sans-serif Office modern). -->
  <match target="pattern">
    <test name="family" compare="eq">
      <string>Aptos</string>
    </test>
    <edit name="family" mode="assign" binding="same">
      <string>Carlito</string>
    </edit>
  </match>

  <match target="pattern">
    <test name="family" compare="eq">
      <string>Aptos Display</string>
    </test>
    <edit name="family" mode="assign" binding="same">
      <string>Carlito</string>
    </edit>
  </match>

  <match target="pattern">
    <test name="family" compare="eq">
      <string>Aptos Narrow</string>
    </test>
    <edit name="family" mode="assign" binding="same">
      <string>Carlito</string>
    </edit>
  </match>
</fontconfig>
"""

konfig.write_text(isi, encoding='utf-8')
print(f'aturan fontconfig ditulis: {konfig}')
