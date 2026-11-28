import { HttpClient, HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, from, of, tap, throwError } from 'rxjs';
import { AuthService } from '@core/auth/auth.service';
import { API_BASE_URL } from '@core/config/api.config';
import { Respaldo } from '../models/respaldo.model';
import { LocalRespaldos } from './local-respaldo.store';

@Injectable({ providedIn: 'root' })
export class RespaldoService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly url = `${inject(API_BASE_URL)}/respaldo`;

  readonly total = signal<number | null>(null);

  /** true cuando el servidor no responde y se usa el almacen local del navegador. */
  readonly modoLocal = signal(false);

  private get usuario(): string {
    return this.auth.session()?.usuario ?? 'admin';
  }

  private conRespaldoLocal<T>(remoto$: Observable<T>, local: () => Observable<T>): Observable<T> {
    return remoto$.pipe(
      tap(() => this.modoLocal.set(false)),
      catchError((e: unknown) => {
        const caido = e instanceof HttpErrorResponse && (e.status === 0 || e.status >= 500);
        if (DEMO_MODE && caido) {
          this.modoLocal.set(true);
          return local();
        }
        return throwError(() => e);
      }),
    );
  }

  /** GET /api/respaldo */
  listar(): Observable<Respaldo[]> {
    return this.conRespaldoLocal(this.http.get<Respaldo[]>(this.url), () =>
      of(LocalRespaldos.listar()),
    ).pipe(tap((data) => this.total.set(Array.isArray(data) ? data.length : 0)));
  }

  /** POST /api/respaldo */
  generar(descripcion?: string): Observable<Respaldo> {
    const texto = descripcion?.trim();
    return this.conRespaldoLocal(
      this.http.post<Respaldo>(this.url, texto ? { descripcion: texto } : {}),
      () => of(LocalRespaldos.crear(texto, this.usuario)),
    );
  }

  /** GET /api/respaldo/{id}/descargar */
  descargar(id: number | string): Observable<HttpResponse<Blob>> {
    return this.conRespaldoLocal(
      this.http.get(`${this.url}/${id}/descargar`, {
        responseType: 'blob',
        observe: 'response',
      }),
      () => of(new HttpResponse<Blob>({ body: LocalRespaldos.blob(id) })),
    );
  }

  /** POST /api/respaldo/{id}/restaurar */
  restaurar(id: number | string): Observable<unknown> {
    return this.conRespaldoLocal<unknown>(this.http.post(`${this.url}/${id}/restaurar`, {}), () =>
      of({ simulado: true }),
    );
  }

  /** POST /api/respaldo/importar */
  importar(archivo: File): Observable<Respaldo> {
    const datos = new FormData();
    datos.append('archivo', archivo, archivo.name);
    return this.conRespaldoLocal(
      this.http.post<Respaldo>(`${this.url}/importar`, datos),
      () => from(LocalRespaldos.importar(archivo, this.usuario)),
    );
  }

  /** DELETE /api/respaldo/{id} */
  eliminar(id: number | string): Observable<void> {
    return this.conRespaldoLocal(this.http.delete<void>(`${this.url}/${id}`), () => {
      LocalRespaldos.eliminar(id);
      return of(undefined);
    });
  }
}