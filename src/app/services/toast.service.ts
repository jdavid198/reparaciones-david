import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  type: ToastType;
  title: string;
  messages: string[]; 
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  toasts = signal<Toast[]>([]);

  show(config: Toast, duration: number = 5000) {
    this.toasts.update((prev) => [...prev, config]);

    setTimeout(() => this.remove(config), duration);
  }


  private remove(toast: Toast) {
    this.toasts.update((prev) => prev.filter((t) => t !== toast));
  }


  success(title: string, messages: string[], duration = 5000) {
    this.show({ type: 'success', title, messages }, duration);
  }

  error(title: string, messages: string[], duration = 5000) {
    this.show({ type: 'error', title, messages }, duration);
  }

  info(title: string, messages: string[], duration = 5000) {
    this.show({ type: 'info', title, messages }, duration);
  }
}
