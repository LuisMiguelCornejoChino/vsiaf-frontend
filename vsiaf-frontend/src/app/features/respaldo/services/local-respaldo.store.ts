import { Respaldo } from '../models/respaldo.model';

const KEY = 'vsiaf.respaldos.locales';

interface Guardado {
  meta: Respaldo;
  zip: string;
}

function leer(): Guardado[] {
  try {
    const datos = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(datos) ? datos : [];
  } catch {
    return [];
  }
}

function escribir(lista: Guardado[]): void {
  localStorage.setItem(KEY, JSON.stringify(lista));
}

function aBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

function deBase64(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes;
}

const TABLA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(datos: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of datos) c = TABLA_CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function crearZip(nombre: string, contenido: string): Uint8Array<ArrayBuffer> {
  const enc = new TextEncoder();
  const n = enc.encode(nombre);
  const d = enc.encode(contenido);
  const crc = crc32(d);
  const local = new DataView(new ArrayBuffer(30));
  local.setUint32(0, 0x04034b50, true);
  local.setUint16(4, 20, true);
  local.setUint32(14, crc, true);
  local.setUint32(18, d.length, true);
  local.setUint32(22, d.length, true);
  local.setUint16(26, n.length, true);
  const central = new DataView(new ArrayBuffer(46));
  central.setUint32(0, 0x02014b50, true);
  central.setUint16(4, 20, true);
  central.setUint16(6, 20, true);
  central.setUint32(16, crc, true);
  central.setUint32(20, d.length, true);
  central.setUint32(24, d.length, true);
  central.setUint16(28, n.length, true);
  const fin = new DataView(new ArrayBuffer(22));
  const tamLocal = 30 + n.length + d.length;
  const tamCentral = 46 + n.length;
  fin.setUint32(0, 0x06054b50, true);
  fin.setUint16(8, 1, true);
  fin.setUint16(10, 1, true);
  fin.setUint32(12, tamCentral, true);
  fin.setUint32(16, tamLocal, true);

  const salida = new Uint8Array(tamLocal + tamCentral + 22);
  let o = 0;
  for (const parte of [
    new Uint8Array(local.buffer), n, d,
    new Uint8Array(central.buffer), n,
    new Uint8Array(fin.buffer),
  ]) {
    salida.set(parte, o);
    o += parte.length;
  }
  return salida;
}

function dosDigitos(x: number): string {
  return String(x).padStart(2, '0');
}

export const LocalRespaldos = {
  listar(): Respaldo[] {
    return leer().map((g) => g.meta);
  },

  crear(descripcion: string | undefined, usuario: string): Respaldo {
    const lista = leer();
    const ahora = new Date();
    const id = lista.reduce((m, g) => Math.max(m, g.meta.codrespaldo), 0) + 1;
    const nombre =
      `respaldo_${ahora.getFullYear()}${dosDigitos(ahora.getMonth() + 1)}${dosDigitos(ahora.getDate())}` +
      `_${dosDigitos(ahora.getHours())}${dosDigitos(ahora.getMinutes())}${dosDigitos(ahora.getSeconds())}.zip`;
    const zip = crearZip(
      'respaldo.json',
      JSON.stringify(
        {
          sistema: 'vSIAF',
          origen: 'modo local (sin conexión con el servidor)',
          fecha: ahora.toISOString(),
          usuario,
          descripcion: descripcion?.trim() ?? '',
        },
        null,
        2,
      ),
    );
    const meta: Respaldo = {
      codrespaldo: id,
      nomrespaldo: nombre,
      fecrespaldo: ahora.toISOString(),
      tamrespaldo: zip.length,
      usuario,
      descripcion: descripcion?.trim() || null,
    };
    escribir([...lista, { meta, zip: aBase64(zip) }]);
    return meta;
  },

  blob(id: number | string): Blob {
    const g = leer().find((x) => x.meta.codrespaldo === Number(id));
    if (!g) throw new Error('Respaldo local no encontrado');
    return new Blob([deBase64(g.zip)], { type: 'application/zip' });
  },

  eliminar(id: number | string): void {
    escribir(leer().filter((g) => g.meta.codrespaldo !== Number(id)));
  },

  async importar(archivo: File, usuario: string): Promise<Respaldo> {
    const bytes = new Uint8Array(await archivo.arrayBuffer());
    const lista = leer();
    const meta: Respaldo = {
      codrespaldo: lista.reduce((m, g) => Math.max(m, g.meta.codrespaldo), 0) + 1,
      nomrespaldo: archivo.name,
      fecrespaldo: new Date().toISOString(),
      tamrespaldo: bytes.length,
      usuario,
      descripcion: 'Importado desde el equipo',
    };
    escribir([...lista, { meta, zip: aBase64(bytes) }]);
    return meta;
  },
};