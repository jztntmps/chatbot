import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './topbar.html',
  styleUrls: ['./topbar.scss'],
})
export class Topbar implements OnInit, OnDestroy {
  @Input() isLoggedIn = false;

  @Output() login = new EventEmitter<void>();
  @Output() signup = new EventEmitter<void>();
  @Output() newChat = new EventEmitter<void>();

  today = '';
  private timer?: number;

  ngOnInit() {
    this.updateDate();
    this.timer = window.setInterval(() => this.updateDate(), 60_000);
  }

  ngOnDestroy() {
    if (this.timer) window.clearInterval(this.timer);
  }

  private updateDate() {
    this.today = new Date().toLocaleDateString('en-US', {
      month: 'long',
      day: '2-digit',
      year: 'numeric',
    });
  }
}
