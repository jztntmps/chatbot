import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './modal.html',
  styleUrls: ['./modal.scss'],
})
export class Modal {
  @Output() close = new EventEmitter<void>();

  rows = [
    { name: 'Account Access Inquiry', date: 'February 16, 2026', checked: false },
    { name: 'Account Access Inquiry', date: 'February 16, 2026', checked: false },
    { name: 'Account Access Inquiry', date: 'February 16, 2026', checked: false },
  ];

  constructor(private router: Router) {}

  onClose() {
    this.close.emit();
  }

  get allChecked() {
    return this.rows.every(r => r.checked);
  }

  toggleAll(checked: boolean) {
    this.rows = this.rows.map(r => ({ ...r, checked }));
  }

  goToPreview() {
    this.router.navigate(['/preview-archive']);
  }
}
