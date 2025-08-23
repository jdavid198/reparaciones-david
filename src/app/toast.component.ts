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

        <div class="toast-header">
          <span class="icon">
            <ng-container [ngSwitch]="t.type">
              <span *ngSwitchCase="'success'">✅</span>
              <span *ngSwitchCase="'error'">❌</span>
              <span *ngSwitchCase="'info'">ℹ️</span>
            </ng-container>
          </span>
          <span class="title">{{ t.title }}</span>
        </div>

        <div class="toast-body">
          <ul>
            <li *ngFor="let msg of t.messages">{{ msg }}</li>
          </ul>
        </div>

        <div class="progress-bar"></div>
      </div>
    </div>
  `,
  styleUrls: ['toast.component.scss']
})
export class ToastComponent {
  constructor(public toastService: ToastService) {}
}
