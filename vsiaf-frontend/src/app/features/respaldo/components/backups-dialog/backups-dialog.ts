import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Respaldo } from '../../models/respaldo.model';
import { RespaldoService } from '../../services/respaldo.service';

interface Mensaje {
  tipo: 'ok' | 'error';
  texto: string;
}

const TZ = 'America/La_Paz';

@Component({
  selector: 'app-backups-dialog',
  imports: [FormsModule],
  templateUrl: './backups-dialog.html',
  styleUrl: './backups-dialog.scss',
  host: { '(document:keydown.escape)': 'cerrar()' },
})
export class BackupsDialog implements OnInit {
  private readonly svc = inject(RespaldoService);

  readonly closed = output<void>();

  protected readonly items = signal<Respaldo[]>([]);
  protected readonly cargando = signal(false);
  protected readonly trabajando = signal(false);
  protected readonly mensaje = signal<Mensaje | null>(null);
  protected readonly seleccionId = signal<number | null>(null);
  /** Descripción que se enviará al generar un respaldo nuevo (sin selección). */
  protected readonly descripcionNueva = signal('');

  protected readonly seleccionado = computed(
    () => this.items().find((r) => r.codrespaldo === this.seleccionId()) ?? null,
  );

  protected readonly modoLocal = this.svc.modoLocal;

  protected readonly ocupado = computed(() => this.cargando() || this.trabajando());

  ngOnInit(): void {
    this.cargar();
  }

  protected cargar(seleccionar?: number | null): void {
    this.cargando.set(true);
    this.svc.listar().subscribe({
      next: (data) => {
        const lista = Array.isArray(data) ? [...data] : [];
        lista.sort((a, b) => new Date(b.fecrespaldo).getTime() - new Date(a.fecrespaldo).getTime());
        this.items.set(lista);
        const mantener = seleccionar ?? this.seleccionId();
        this.seleccionId.set(lista.some((r) => r.codrespaldo === mantener) ? mantener! : null);
        this.cargando.set(false);
      },
      error: (e) => {
        this.cargando.set(false);
        this.error(e);
      },
    });
  }

  protected seleccionar(r: Respaldo): void {
    this.seleccionId.set(r.codrespaldo);
    this.mensaje.set(null);
  }

  protected deseleccionar(): void {
    this.seleccionId.set(null);
  }

  // ---- Acciones de la barra de botones ----

  protected respaldar(): void {
    this.trabajando.set(true);
    this.mensaje.set(null);
    this.svc.generar(this.descripcionNueva()).subscribe({
      next: (nuevo) => {
        this.trabajando.set(false);
        this.descripcionNueva.set('');
        this.ok('Respaldo generado correctamente.');
        this.cargar(nuevo?.codrespaldo ?? null);
      },
      error: (e) => {
        this.trabajando.set(false);
        this.error(e);
      },
    });
  }

  protected restaurar(): void {
    const r = this.seleccionado();
    if (!r) return;
    if (
      !confirm(
        `¿Restaurar la base de datos con "${r.nomrespaldo}"?\nSe reemplazarán los datos actuales.`,
      )
    )
      return;
    this.trabajando.set(true);
    this.svc.restaurar(r.codrespaldo).subscribe({
      next: () => {
        this.trabajando.set(false);
        this.ok(this.modoLocal() ? 'Restauraci\u00f3n simulada: en modo local no hay base de datos conectada.' : 'Base de datos restaurada correctamente.');
        this.cargar();
      },
      error: (e) => {
        this.trabajando.set(false);
        this.error(e);
      },
    });
  }

  /** "Copiar a ..." → guarda el .zip en la computadora del usuario. */
  protected copiarA(): void {
    const r = this.seleccionado();
    if (!r) return;
    this.trabajando.set(true);
    this.svc.descargar(r.codrespaldo).subscribe({
      next: (resp) => {
        this.trabajando.set(false);
        const blob = resp.body;
        if (!blob) return;
        const enlace = document.createElement('a');
        enlace.href = URL.createObjectURL(blob);
        enlace.download = this.nombreArchivo(r);
        enlace.click();
        URL.revokeObjectURL(enlace.href);
        this.ok('Respaldo copiado a tu equipo.');
      },
      error: (e) => {
        this.trabajando.set(false);
        this.error(e);
      },
    });
  }

  /** "Copiar de ..." → sube un .zip desde la computadora del usuario. */
  protected copiarDe(evento: Event): void {
    const input = evento.target as HTMLInputElement;
    const archivo = input.files?.[0];
    input.value = '';
    if (!archivo) return;
    this.trabajando.set(true);
    this.svc.importar(archivo).subscribe({
      next: (nuevo) => {
        this.trabajando.set(false);
        this.ok('Respaldo importado correctamente.');
        this.cargar(nuevo?.codrespaldo ?? null);
      },
      error: (e) => {
        this.trabajando.set(false);
        this.error(e);
      },
    });
  }

  protected borrar(): void {
    const r = this.seleccionado();
    if (!r) return;
    if (!confirm(`¿Borrar el respaldo "${r.nomrespaldo}"?`)) return;
    this.trabajando.set(true);
    this.svc.eliminar(r.codrespaldo).subscribe({
      next: () => {
        this.trabajando.set(false);
        this.seleccionId.set(null);
        this.ok('Respaldo borrado.');
        this.cargar();
      },
      error: (e) => {
        this.trabajando.set(false);
        this.error(e);
      },
    });
  }

  protected cerrar(): void {
    this.closed.emit();
  }

  // ---- Formato ----

  protected nombreSinZip(r: Respaldo): string {
    return r.nomrespaldo.replace(/\.zip$/i, '');
  }

  private nombreArchivo(r: Respaldo): string {
    return /\.zip$/i.test(r.nomrespaldo) ? r.nomrespaldo : `${r.nomrespaldo}.zip`;
  }

  protected dia(iso: string): string {
    const d = new Date(iso);
    return isNaN(d.getTime())
      ? ''
      : d.toLocaleDateString('es-BO', {
          timeZone: TZ,
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });
  }

  protected hora(iso: string): string {
    const d = new Date(iso);
    return isNaN(d.getTime())
      ? ''
      : d.toLocaleTimeString('es-BO', { timeZone: TZ, hour12: false });
  }

  protected tamano(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  }

  // ---- Mensajes ----

  private ok(texto: string): void {
    this.mensaje.set({ tipo: 'ok', texto });
  }

  private error(e: unknown): void {
    const status = e instanceof HttpErrorResponse ? e.status : -1;
    let texto: string;
    if (status === 0) {
      texto = 'Sin conexión con el servidor (puede estar iniciando en Render; reintenta en un minuto).';
    } else if (status === 404 || status === 405 || status === 501) {
      texto = 'El servidor todavía no ofrece esta operación.';
    } else {
      texto = `Error del servidor (${status}).`;
    }
    this.mensaje.set({ tipo: 'error', texto });
  }
}
