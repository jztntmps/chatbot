import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Modal } from '../modal/modal';

type ChatPreview = {
  id: string;
  title: string;
};

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, Modal],
  templateUrl: './sidebar.html',
  styleUrls: ['./sidebar.scss'],
})
export class SidebarComponent {
  @Input() isOpen = true;
  @Input() username = 'User';
  @Input() avatarUrl = '';

  @Input() chats: ChatPreview[] = [
    { id: '1', title: '...' },
    { id: '2', title: '...' },
    { id: '3', title: '...' },
  ];

  @Output() toggle = new EventEmitter<void>();
  @Output() newChat = new EventEmitter<void>();
  @Output() openChat = new EventEmitter<string>();
  @Output() seeAll = new EventEmitter<void>();
  @Output() archive = new EventEmitter<void>();
  @Output() logout = new EventEmitter<void>();

  settingsOpen = false;
  showModal = false;

  trackById(_: number, c: ChatPreview) {
    return c.id;
  }

  toggleSettings() {
    this.settingsOpen = !this.settingsOpen;
  }

  clickArchive() {
    this.settingsOpen = false;
    this.showModal = true;
    this.archive.emit();
  }

  clickLogout() {
    this.settingsOpen = false;
    this.logout.emit();
  }

  selectChat(id: string) {
    this.openChat.emit(id);
    this.settingsOpen = false;
  }

  closeModal() {
    this.showModal = false;
  }
}
