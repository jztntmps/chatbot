// sidebar.ts
import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

import { Modal } from '../modal/modal';

// ✅ service-driven modal
import { UiModalService } from '../../../shared/ui-modal/ui-modal.service';

type ChatPreview = { id: string; title: string };

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, Modal], // ✅ UiModalComponent NOT needed here
  templateUrl: './sidebar.html',
  styleUrls: ['./sidebar.scss'],
})
export class SidebarComponent {
  constructor(private uiModal: UiModalService) {}

  @Input() isOpen = true;
  @Input() username = 'User';
  @Input() avatarUrl = '';
  @Input() userId: string = '';
  @Input() chats: ChatPreview[] = [];

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
    return this.username ? this.username.charAt(0).toUpperCase() : 'U';
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
    // opens archived modal list
    this.settingsOpen = false;
    this.openMenuId = null;
    this.showModal = true;
    this.archive.emit();
  }

  async clickLogout() {
    this.settingsOpen = false;
    this.openMenuId = null;

    const ok = await this.uiModal.confirm({
      title: 'Logout?',
      message: 'You will be signed out of your account. Continue?',
      variant: 'neutral',
      icon: 'question',
      confirmText: 'Logout',
      cancelText: 'Cancel',
      showCancel: true,
    });

    if (!ok) return;

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

  // ==========================================
  // ✅ Archive/Delete confirmations using UiModalService
  // ==========================================
  async archiveChat(chatId: string) {
    const ok = await this.uiModal.confirm({
      title: 'Archive chat?',
      message: 'This chat will be moved to Archived Chats. Continue?',
      variant: 'neutral',
      icon: 'question',
      confirmText: 'Archive',
      cancelText: 'Cancel',
      showCancel: true,
    });

    if (!ok) return;

    this.openMenuId = null;
    this.archiveChatId.emit(chatId);
  }

  async deleteChat(chatId: string) {
    const ok = await this.uiModal.confirm({
      title: 'Delete chat?',
      message: 'This will permanently delete the conversation. Continue?',
      variant: 'danger',
      icon: 'warning',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      showCancel: true,
    });

    if (!ok) return;

    this.openMenuId = null;
    this.deleteChatId.emit(chatId);
  }

  @HostListener('document:click')
  onDocClick() {
    this.openMenuId = null;
    this.settingsOpen = false;
  }

  onArchiveChanged() {
    this.showModal = false;
    this.refreshChats.emit();
  }
}