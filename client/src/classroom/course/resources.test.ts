import { describe, expect, it } from 'vitest';
import { extensionOf, formatBytes, searchResources, titleFromFileName } from './resources';

describe('recursos', () => {
  it('formatea tamaños como los lee el docente', () => {
    expect(formatBytes(900)).toBe('900 B');
    expect(formatBytes(850 * 1024)).toBe('850 KB');
    expect(formatBytes(2.4 * 1024 * 1024)).toBe('2,4 MB');
  });

  it('sugiere un título legible y extrae la extensión', () => {
    expect(titleFromFileName('guia_de-limites.pdf')).toBe('Guia de limites');
    expect(extensionOf('Rúbrica.final.docx')).toBe('DOCX');
    expect(extensionOf('sin-extension')).toBe('');
  });

  it('busca por título o archivo', () => {
    const items = [
      { id: 1, title: 'Rúbrica institucional', fileName: 'rubrica.pdf', fileUrl: '', sizeBytes: 1, assignmentId: null, createdAt: '' },
      { id: 2, title: 'Plantilla', fileName: 'reporte.docx', fileUrl: '', sizeBytes: 1, assignmentId: null, createdAt: '' },
    ];
    expect(searchResources(items, 'RÚBRICA').map((r) => r.id)).toEqual([1]);
    expect(searchResources(items, 'reporte').map((r) => r.id)).toEqual([2]);
    expect(searchResources(items, '  ')).toHaveLength(2);
  });
});
