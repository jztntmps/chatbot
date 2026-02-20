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

  /**
   * ✅ Pass your chat messages here from parent (chat page).
   * This component will export them to PDF.
   */
  @Input() messages: ChatMessage[] = [];

  @Output() login = new EventEmitter<void>();
  @Output() signup = new EventEmitter<void>();
  @Output() newChat = new EventEmitter<void>();
  @Output() toggleSidebar = new EventEmitter<void>();

  // dropdown actions
  @Output() archive = new EventEmitter<void>();
  @Output() deleteChat = new EventEmitter<void>();
  @Output() exportChat = new EventEmitter<void>();  

  today = '';
  private timer?: number;

  menuOpen = false;

  constructor(private el: ElementRef) {}

  ngOnInit() {
    this.updateDate();
    this.timer = window.setInterval(() => this.updateDate(), 60_000);
  }

  ngOnDestroy() {
    if (this.timer) window.clearInterval(this.timer);
  }

  onToggleSidebar() {
    console.log('[topbar] menu clicked');
    this.toggleSidebar.emit();
  }

  // dots menu
  toggleMenu(ev: MouseEvent) {
    ev.stopPropagation();
    this.menuOpen = !this.menuOpen;
  }

  closeMenu() {
    this.menuOpen = false;
  }

  onArchive() {
    this.archive.emit();
    this.closeMenu();
  }

  // ✅ EXPORT AS PDF
  onExport() {
    this.exportChat.emit();
    this.closeMenu();
  }

  onDelete() {
    this.deleteChat.emit();
    this.closeMenu();
  }

  // close when clicking outside
  @HostListener('document:click', ['$event'])
  onDocClick(event: MouseEvent) {
    if (!this.menuOpen) return;
    const clickedInside = this.el.nativeElement.contains(event.target as Node);
    if (!clickedInside) this.closeMenu();
  }

  // close on ESC
  @HostListener('document:keydown.escape')
  onEsc() {
    this.closeMenu();
  }

  private updateDate() {
    this.today = new Date().toLocaleDateString('en-US', {
      month: 'long',
      day: '2-digit',
      year: 'numeric',
    });
  }

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
      const role = (m.role === 'user') ? 'You' : 'Assistant';
      const content = (m.content ?? m.message ?? m.text ?? '').toString().trim();

      if (!content) continue;

      // role label
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(`${role}:`, margin, y);
      y += 14;

      // content
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