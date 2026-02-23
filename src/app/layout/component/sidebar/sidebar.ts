import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
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
  @Input() userId: string = '';

  @Input() chats: ChatPreview[] = [
    { id: '1', title: '...' },
    { id: '2', title: '...' },
    { id: '3', title: '...' },
  ];
  @Output() openArchive = new EventEmitter<void>();
  @Output() toggle = new EventEmitter<void>();
  @Output() newChat = new EventEmitter<void>();
  @Output() openChat = new EventEmitter<string>();
  @Output() seeAll = new EventEmitter<void>();
  @Output() archive = new EventEmitter<void>();
  @Output() logout = new EventEmitter<void>();
  @Output() exportChatId = new EventEmitter<string>();

  // per chat actions
  @Output() archiveChatId = new EventEmitter<string>();
  @Output() deleteChatId = new EventEmitter<string>();
  @Output() refreshChats = new EventEmitter<void>();

  settingsOpen = false;
  showAll = false;
  showModal = false;

  openMenuId: string | null = null;

  get profileInitial(): string {
  if (!this.username) return 'U';
  return this.username.charAt(0).toUpperCase();
}



  trackById(_: number, c: ChatPreview) {
    return c.id;
  }

  toggleSettings() {
    this.settingsOpen = !this.settingsOpen;
    this.openMenuId = null;
  }

  toggleSeeAll() {
    this.showAll = !this.showAll;
    this.settingsOpen = false;
    this.openMenuId = null;
    this.seeAll.emit();
  }

  exportChat(id: string) {
  this.settingsOpen = false;
  this.openMenuId = null;
  this.exportChatId.emit(id);
}

  clickArchive() {
    this.settingsOpen = false;
    this.openMenuId = null;
    this.showModal = true;
    this.archive.emit();
  }

  clickLogout() {
    this.settingsOpen = false;
    this.openMenuId = null;
    this.logout.emit();
  }

  selectChat(id: string) {
    this.openChat.emit(id);
    this.settingsOpen = false;
    this.openMenuId = null;
  }

  closeModal() {
    this.showModal = false;
  }

  openDots(event: MouseEvent, chatId: string) {
    event.stopPropagation();
    this.settingsOpen = false;
    this.openMenuId = this.openMenuId === chatId ? null : chatId;
  }

  archiveChat(chatId: string) {
    this.openMenuId = null;
    this.archiveChatId.emit(chatId);
  }
 


  deleteChat(chatId: string) {
    this.openMenuId = null;
    this.deleteChatId.emit(chatId);
  }

  @HostListener('document:click')
  onDocClick() {
    this.openMenuId = null;
    this.settingsOpen = false;
  }
  onArchiveChanged() {
  // close modal if you want
  this.showModal = false;

  // tell Chatbox to reload conversations from DB
  this.refreshChats.emit();
}
}
