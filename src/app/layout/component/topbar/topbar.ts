import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { jsPDF } from 'jspdf';
import { UiModalService } from '../../../shared/ui-modal/ui-modal.service';

type ChatMessage = {
  role: 'user' | 'ai' | 'assistant' | 'bot';
  content?: string;
  message?: string;
  text?: string;
  createdAt?: string;
};

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './topbar.html',
  styleUrls: ['./topbar.scss'],
})
export class Topbar implements OnInit, OnDestroy {
  @Input() isLoggedIn = false;

  /** ✅ chat messages for export */
  @Input() messages: ChatMessage[] = [];

  /** ✅ current opened conversation id (needed for archive/delete) */
  @Input() currentConversationId: string | null = null;

  @Output() login = new EventEmitter<void>();
  @Output() signup = new EventEmitter<void>();
  @Output() newChat = new EventEmitter<void>();
  @Output() toggleSidebar = new EventEmitter<void>();

  /** ✅ Topbar dropdown actions (emit with conversation id) */
  @Output() archiveChatId = new EventEmitter<string>();
  @Output() deleteChatId = new EventEmitter<string>();
  @Output() exportChat = new EventEmitter<void>();

  today = '';
  private timer?: number;

  menuOpen = false;

  constructor(
    private el: ElementRef,
    private uiModal: UiModalService // ✅ ADD
  ) {}

  ngOnInit() {
    this.updateDate();
    this.timer = window.setInterval(() => this.updateDate(), 60_000);
  }

  ngOnDestroy() {
    if (this.timer) window.clearInterval(this.timer);
  }

  onToggleSidebar() {
    this.toggleSidebar.emit();
  }

  /* =========================
     DOTS MENU
  ========================= */

  toggleMenu(ev: MouseEvent) {
    ev.stopPropagation();
    this.menuOpen = !this.menuOpen;
  }

  closeMenu() {
    this.menuOpen = false;
  }

  // =========================
  // ✅ ARCHIVE with confirm + success
  // =========================
  async onArchive() {
    const id = (this.currentConversationId || '').trim();
    if (!id) {
      this.closeMenu();
      await this.uiModal.notify({
        title: 'No chat selected',
        message: 'Please open a conversation first.',
        variant: 'neutral',
        icon: 'question',
        autoCloseMs: 2200,
      });
      return;
    }

    this.closeMenu();

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

    // ✅ Let parent do the API call
    this.archiveChatId.emit(id);

    // ✅ Success toast/modal (optional)
    await this.uiModal.notify({
      title: 'Archived',
      message: 'Chat moved to Archived Chats.',
      variant: 'success',
      icon: 'success',
      autoCloseMs: 3000,
    });
  }

  // =========================
  // ✅ DELETE with confirm + success
  // =========================
  async onDelete() {
    const id = (this.currentConversationId || '').trim();
    if (!id) {
      this.closeMenu();
      await this.uiModal.notify({
        title: 'No chat selected',
        message: 'Please open a conversation first.',
        variant: 'neutral',
        icon: 'question',
        autoCloseMs: 2200,
      });
      return;
    }

    this.closeMenu();

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

    // ✅ Let parent do the API call
    this.deleteChatId.emit(id);

    // ✅ Success toast/modal (optional)
    await this.uiModal.notify({
      title: 'Deleted',
      message: 'Chat deleted successfully.',
      variant: 'success',
      icon: 'success',
      autoCloseMs: 3000,
    });
  }

  onExport() {
    this.exportChat.emit();
    this.closeMenu();
  }

  /* =========================
     CLOSE MENU ON OUTSIDE CLICK / ESC
  ========================= */

  @HostListener('document:click', ['$event'])
  onDocClick(event: MouseEvent) {
    if (!this.menuOpen) return;
    const clickedInside = this.el.nativeElement.contains(event.target as Node);
    if (!clickedInside) this.closeMenu();
  }

  @HostListener('document:keydown.escape')
  onEsc() {
    this.closeMenu();
  }

  /* =========================
     DATE
  ========================= */

  private updateDate() {
    this.today = new Date().toLocaleDateString('en-US', {
      month: 'long',
      day: '2-digit',
      year: 'numeric',
    });
  }

  /* =========================
     OPTIONAL PDF EXPORT (unused if parent handles export)
  ========================= */

  private downloadConversationAsPdf() {
    if (!this.messages || this.messages.length === 0) {
      alert('No conversation to export yet.');
      return;
    }

    const doc = new jsPDF({ unit: 'pt', format: 'a4' });

    const margin = 40;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const maxWidth = pageWidth - margin * 2;

    let y = 50;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('Conversation Export', margin, y);
    y += 20;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Exported: ${new Date().toLocaleString()}`, margin, y);
    y += 18;

    doc.setDrawColor(180);
    doc.line(margin, y, pageWidth - margin, y);
    y += 18;

    for (const m of this.messages) {
      const role = m.role === 'user' ? 'You' : 'Assistant';
      const content = (m.content ?? m.message ?? m.text ?? '').toString().trim();

      if (!content) continue;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(`${role}:`, margin, y);
      y += 14;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);

      const lines = doc.splitTextToSize(content, maxWidth);
      for (const line of lines) {
        if (y > pageHeight - 60) {
          doc.addPage();
          y = 50;
        }
        doc.text(line, margin, y);
        y += 14;
      }

      y += 10;
    }

    doc.save(`conversation-${Date.now()}.pdf`);
  }
}