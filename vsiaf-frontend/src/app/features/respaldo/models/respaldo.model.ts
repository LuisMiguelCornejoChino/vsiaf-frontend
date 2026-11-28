export interface Respaldo {
  codrespaldo: number;
  nomrespaldo: string;
  fecrespaldo: string;
  tamrespaldo: number;
  /** Opcionales: se muestran si el backend los envía. */
  usuario?: string | null;
  descripcion?: string | null;
}

export const RESPALDO_ID = 'codrespaldo';
