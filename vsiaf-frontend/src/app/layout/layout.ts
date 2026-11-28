import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { AuthService } from '@core/auth/auth.service';
import { BackupsDialog } from '../features/respaldo/components/backups-dialog/backups-dialog';
import { RespaldoService } from '../features/respaldo/services/respaldo.service';
import { AboutDialog } from './about-dialog/about-dialog';

interface MenuItem {
  label: string;
  /** Índice de la letra subrayada (atajo). */
  mnemonic: number;
  action?: 'logout' | 'backups';
  /** Ruta a la que navega al pulsar el botón. */
  route?: string;
}

@Component({
  selector: 'app-layout',
  imports: [RouterOutlet, AboutDialog, BackupsDialog],
  templateUrl: './layout.html',
  styleUrl: './layout.scss',
})
export class Layout implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly respaldos = inject(RespaldoService);

  protected readonly session = this.auth.session;
  protected readonly backups = this.respaldos.total;
  protected readonly sidebarOpen = signal(false);
  protected readonly aboutOpen = signal(false);
  protected readonly backupsOpen = signal(false);
  protected readonly active = signal<string | null>(null);

  private static readonly THEMES = [
    '1.PNG',
    '2.PNG',
    '3.PNG',
    '4.PNG',
    '5.PNG',
    '7.PNG',
    '8.PNG',
    '9.PNG',
  ];

  protected readonly headerBackground = `url('assets/images/barravsiaf.jpg')`;

  protected readonly background =`url('assets/images/themes/${
    Layout.THEMES[Math.floor(Math.random() * Layout.THEMES.length)]
  }')`;

  protected readonly menu: MenuItem[] = [
    { label: 'Activos Fijos', mnemonic: 0 },
    { label: 'Grupos y Auxiliares', mnemonic: 0 },
    { label: 'Oficinas y Responsables', mnemonic: 0 },
    { label: 'Generar Reportes', mnemonic: 8 },
    { label: 'Administradores', mnemonic: 1 },
    { label: 'Iniciar sesión', mnemonic: 0, action: 'logout' },
    { label: 'Respaldos BD', mnemonic: 10, action: 'backups' },
    { label: 'Administrar Unidad', mnemonic: 1 },
    { label: 'Localizacion BD', mnemonic: 0 },
  ];

  ngOnInit(): void {
    // Carga la cantidad de respaldos para la cabecera (si falla, se queda en "None").
    this.respaldos.listar().subscribe({ error: () => undefined });
  }

  protected toggleSidebar(): void {
    this.sidebarOpen.update((open) => !open);
  }

  protected select(item: MenuItem): void {
    if (item.action === 'logout') {
      this.logout();
      return;
    }
    this.active.set(item.label);
    this.sidebarOpen.set(false);
    if (item.action === 'backups') {
      this.backupsOpen.set(true);
      return;
    }
    if (item.route) {
      this.router.navigateByUrl(item.route);
    }
  }

  protected logout(): void {
    this.auth.logout();
    this.router.navigateByUrl('/login');
  }
}


