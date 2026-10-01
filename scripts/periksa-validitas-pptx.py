"""Memeriksa apakah PPTX valid menurut skema OOXML.

Kalau XML-nya valid, berarti foto kosong di render LibreOffice adalah
keterbatasan LibreOffice (tidak merender blipFill pada autoshape),
bukan kesalahan berkas.
"""

import re
import zipfile

BERKAS = '/home/ubuntu/projects/btn-sip/ranking-nyata.pptx'
z = zipfile.ZipFile(BERKAS)

print('=== 1. semua berkas XML bisa di-parse? ===')
import xml.etree.ElementTree as ET
rusak = 0
for nama in z.namelist():
    if not nama.endswith('.xml') and not nama.endswith('.rels'):
        continue
    try:
        ET.fromstring(z.read(nama))
    except Exception as e:
        print(f'  RUSAK: {nama} -> {e}')
        rusak += 1
print(f'  {rusak} berkas rusak dari {sum(1 for n in z.namelist() if n.endswith((".xml", ".rels")))}')

print('\n=== 2. urutan elemen dalam bentuk FOTO_ (skema OOXML) ===')
P = '{http://schemas.openxmlformats.org/presentationml/2006/main}'
s = z.read('ppt/slides/slide2.xml').decode()
akar = ET.fromstring(s)
for sp in akar.iter(f'{P}sp'):
    nv = sp.find(f'{P}nvSpPr/{P}cNvPr')
    if nv is None or 'FOTO_' not in (nv.get('name') or ''):
        continue
    print(f'  bentuk: {nv.get("name")}')
    urutan = []
    for anak in sp:
        urutan.append(anak.tag.split('}')[-1])
    print(f'  urutan anak: {urutan}')
    # skema: nvSpPr, spPr, style?, txBody?  -- blipFill di dalam spPr/level sp
    baik = urutan[:2] == ['nvSpPr', 'spPr']
    print(f'  sesuai skema? {"YA" if baik else "TIDAK"}')
    # cek blipFill
    bf = sp.find(f'{P}blipFill')
    print(f'  blipFill ada di level sp? {"YA" if bf is not None else "TIDAK"}')
    if bf is not None:
        blip = bf.find('{http://schemas.openxmlformats.org/drawingml/2006/main}blip')
        print(f'    r:embed = {blip.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed") if blip is not None else "-"}')

print('\n=== 3. relasi gambar cocok? ===')
rel = z.read('ppt/slides/_rels/slide2.xml.rels').decode()
for m in re.finditer(r'Id="(rId\d+)"[^>]*Target="\.\./media/([^"]+)"', rel):
    rid, berkas = m.group(1), m.group(2)
    ada = f'ppt/media/{berkas}' in z.namelist()
    ukuran = len(z.read(f'ppt/media/{berkas}')) if ada else 0
    print(f'  {rid} -> {berkas}  (ada={ada}, {ukuran} byte)')

print('\n=== 4. jenis gambar di relasi vs isi berkas ===')
for m in re.finditer(r'Target="\.\./media/(image1\.jpeg)"', rel):
    isi = z.read(f'ppt/media/{m.group(1)}')
    print(f'  {m.group(1)}: awal byte = {isi[:4].hex()}  '
          f'({"JPEG" if isi[:2] == b"\\xff\\xd8" else "BUKAN JPEG"})')
