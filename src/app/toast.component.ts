import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from './services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-container">
      <div *ngFor="let t of toastService.toasts()" 
           class="toast" 
           [ngClass]="t.type">
        {{ t.message }}
      </div>
    </div>
  `,
  styleUrls: ['toast.component.scss']
})
export class ToastComponent {
  constructor(public toastService: ToastService) {}
}
