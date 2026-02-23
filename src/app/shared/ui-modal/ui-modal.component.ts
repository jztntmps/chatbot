import { Component, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UiModalService } from './ui-modal.service';

@Component({
  selector: 'ui-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ui-modal.component.html',
  styleUrls: ['./ui-modal.component.scss'],
})
export class UiModalComponent {
  constructor(public modal: UiModalService) {}

  @HostListener('document:keydown.escape')
  onEsc() {
    this.modal._resolve(false);
  }
}