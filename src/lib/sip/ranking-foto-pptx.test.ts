import { describe, expect, it } from 'vitest';
import { fotoUntukRankingPptx, nipDalamRanking } from './ranking-foto-pptx';

const peserta = [
  { nip: '111', fotoPenilaian: 'data:image/jpeg;base64,assessment', fotoProfil: 'data:image/jpeg;base64,profile' },
  { nip: '222', fotoPenilaian: null, fotoProfil: 'data:image/png;base64,profile-only' },
  { nip: '333', fotoPenilaian: null, fotoProfil: null },
  { nip: '999', fotoPenilaian: 'data:image/jpeg;base64,extra', fotoProfil: null },
];

describe('data foto ranking PPTX', () => {
  it('memuat roster hanya dari peserta hasil filter ranking termasuk cabang turunan', () => {
    expect(nipDalamRanking([{ nip: '111' }, { nip: '222' }, { nip: '333' }])).toEqual(['111', '222', '333']);
  });

  it('memakai foto penilaian lalu foto profil sebagai fallback, tanpa peserta di luar roster', () => {
    expect(fotoUntukRankingPptx(['111', '222', '333'], peserta)).toEqual(new Map([
      ['111', 'data:image/jpeg;base64,assessment'],
      ['222', 'data:image/png;base64,profile-only'],
    ]));
  });
});
