import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'info';

@Injectable({ providedIn: 'root' })
export class ToastService {
  toasts = signal<{ message: string; type: ToastType }[]>([]);

  show(message: string, type: ToastType = 'success') {
    this.toasts.update((prev) => [...prev, { message, type }]);
    setTimeout(() => this.remove(message), 3000);
  }

  private remove(message: string) {
    this.toasts.update((prev) => prev.filter((t) => t.message !== message));
  }
}
