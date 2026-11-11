import { describe, expect, it } from 'vitest';
import config from '../../../next.config';

describe('konfigurasi root Turbopack', () => {
  it('mengunci root build ke repository aplikasi, bukan direktori home', () => {
    expect(config.turbopack?.root).toBe(process.cwd());
  });
});
