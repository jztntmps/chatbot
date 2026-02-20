import { Component, ChangeDetectorRef, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, NavigationEnd } from '@angular/router';
import {
  HttpClient,
  HttpClientModule,
  HttpErrorResponse,
} from '@angular/common/http';

import { Topbar } from '../topbar/topbar';
import { FooterComponent } from '../footer/footer';
import { SidebarComponent } from '../sidebar/sidebar';

// ✅ FIXED PATH (chatbox.ts is in src/app/layout/component/chatbox/)
import { ConversationService } from '../../../services/conversation';

import { firstValueFrom, Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { timeout } from 'rxjs/operators';
import { jsPDF } from 'jspdf';

type ChatMsg = { role: 'user' | 'ai'; text: string };
type ChatPreview = { id: string; title: string };

@Component({
  selector: 'app-chatbox',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    HttpClientModule,
    Topbar,
    FooterComponent,
    SidebarComponent,
  ],
  templateUrl: './chatbox.html',
  styleUrls: ['./chatbox.scss'],
})
export class Chatbox implements OnInit, OnDestroy {
  // topbar
  isLoggedIn = false;

  // sidebar
  sidebarOpen = true;
  userEmail = 'User';
  chats: ChatPreview[] = [];

  // chat
  message = '';
  sending = false;
  messages: ChatMsg[] = [];

  // ✅ conversation tracking
  userId = ''; // must be real userId (not email)
  activeConversationId: string | null = null;

  private readonly API_URL = 'http://localhost:8080/api/chat';
  private readonly CONVO_BASE = 'http://localhost:8080/api/conversations';

  private navSub?: Subscription;
  private warnedNoSave = false;

  constructor(
    private http: HttpClient,
    private convoApi: ConversationService,
    private cdr: ChangeDetectorRef,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.syncAuth();

    // ✅ sync again whenever route changes to /chatbox
    this.navSub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        if (e.urlAfterRedirects.includes('/chatbox')) {
          this.syncAuth();
        }
      });

    if (this.messages.length === 0) {
      this.messages = [];
    }
  }

  ngOnDestroy(): void {
    this.navSub?.unsubscribe();
  }

  private syncAuth() {
    const saved = localStorage.getItem('isLoggedIn');

    this.isLoggedIn = saved === 'true' || saved === '1';
    this.userEmail = localStorage.getItem('userEmail') || 'User';
    this.userId = localStorage.getItem('userId') || '';

    // ✅ restore active conversation across refresh (ONLY if logged in)
    const savedConvoIdRaw = localStorage.getItem('activeConversationId');
    const savedConvoId = this.normalizeId(savedConvoIdRaw);
    this.activeConversationId = this.isLoggedIn ? savedConvoId : null;

    console.log('[syncAuth]', {
      isLoggedInRaw: saved,
      isLoggedIn: this.isLoggedIn,
      userId: this.userId,
      userEmail: this.userEmail,
      activeConversationId: this.activeConversationId,
    });

    if (this.isLoggedIn && this.userId) {
      this.loadConversations();
      // ⚠️ DO NOT auto-open saved convo here (can cause 500 loop if id is stale)
      // user can click a chat in sidebar to open it
    } else {
      this.chats = [];
      this.activeConversationId = null;
      localStorage.removeItem('activeConversationId');
    }

    this.cdr.detectChanges();
  }

  private normalizeId(id: string | null): string | null {
    if (!id) return null;
    const v = id.trim();
    if (!v || v === 'null' || v === 'undefined') return null;
    return v;
  }

  private async loadConversations() {
    try {
      const list: any[] = await firstValueFrom(
        this.convoApi.getByUser(this.userId).pipe(timeout(120000))
      );

      this.chats = (list || []).map((c: any) => ({
        id: this.extractConversationId(c) || '',
        title: c.title || '(Untitled)',
      })).filter(x => !!x.id);

      this.cdr.detectChanges();
    } catch (e) {
      console.error('Failed to load conversations', e);
      this.chats = [];
    }
  }

  toggleSidebar() {
    this.sidebarOpen = !this.sidebarOpen;
    this.cdr.detectChanges();
  }

  async openChat(chatId: string) {
    const normalized = this.normalizeId(chatId);
    if (!normalized) return;

    try {
      const convo = await firstValueFrom(
        this.http.get<any>(`${this.CONVO_BASE}/${normalized}`).pipe(timeout(120000))
      );

      this.activeConversationId = this.extractConversationId(convo) || normalized;
      localStorage.setItem('activeConversationId', this.activeConversationId);

      const turns = convo?.turns || [];
      const rebuilt: ChatMsg[] = [];

      for (const t of turns) {
        if (t?.userMessage) rebuilt.push({ role: 'user', text: t.userMessage });
        if (t?.botResponse) rebuilt.push({ role: 'ai', text: t.botResponse });
      }

      this.messages = rebuilt.length ? rebuilt : [];
      this.scrollToBottom();
      this.cdr.detectChanges();
    } catch (e) {
      console.error('Open chat failed', e);

      // ✅ if saved id is stale, clear it so we stop failing
      this.activeConversationId = null;
      localStorage.removeItem('activeConversationId');

      this.messages.push({ role: 'ai', text: '⚠️ Failed to open conversation (maybe deleted). Starting a new chat.' });
      this.scrollToBottom();
    }
  }

  seeAll() {}
  openSettings() {}

  startNewChat() {
    this.messages = [{ role: 'ai', text: 'Hi! Ask me anything.' }];
    this.message = '';
    this.sending = false;

    // ✅ IMPORTANT: new chat = new conversation (new title on next send)
    this.activeConversationId = null;
    localStorage.removeItem('activeConversationId');

    this.scrollToBottom();
  }

  goLogin() {
    this.router.navigate(['/indexlogin']);
  }

  goSignup() {
    this.router.navigate(['/signup']);
  }

  goArchive() {
    console.log('Archive clicked');
  }

  logout() {
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userId');
    localStorage.removeItem('activeConversationId');

    this.syncAuth();
    this.router.navigate(['/']);
  }

  async sendMessage() {
    const text = this.message.trim();
    if (!text || this.sending) return;

    const canSave = this.isLoggedIn && !!this.userId;

    if (!canSave && !this.warnedNoSave) {
      this.warnedNoSave = true;
      this.messages.push({
        role: 'ai',
        text: '⚠️ You are not fully logged in (missing userId). Chat will work, but it won’t be saved.',
      });
    }

    this.messages.push({ role: 'user', text });
    this.message = '';
    this.sending = true;
    this.scrollToBottom();

    try {
      // 1) get chatbot reply
      const res = await firstValueFrom(
        this.http
          .post<{ reply: string }>(this.API_URL, { message: text })
          .pipe(timeout(120000))
      );

      const reply = (res?.reply ?? '').trim() || '(Empty reply)';
      this.messages.push({ role: 'ai', text: reply });

      // 2) SAVE TO DB only if allowed
      if (canSave) {
        // normalize active id (protect from "null"/"undefined")
        this.activeConversationId = this.normalizeId(this.activeConversationId);

        if (!this.activeConversationId) {
          // ✅ FIRST MESSAGE ONLY: creates conversation + title
          const created = await firstValueFrom(
            this.convoApi.createConversation({
              userId: this.userId,
              firstUserMessage: text,
              firstBotResponse: reply,
            }).pipe(timeout(120000))
          );

          const convoId = this.extractConversationId(created);
          this.activeConversationId = this.normalizeId(convoId);

          console.log('[createConversation] response:', created);
          console.log('[createConversation] extracted id:', this.activeConversationId);

          if (this.activeConversationId) {
            localStorage.setItem('activeConversationId', this.activeConversationId);
          } else {
            console.error('❌ No conversationId returned by backend. Check Conversation model serialization.');
          }

          this.loadConversations();
        } else {
          // ✅ NEXT MESSAGES: append turns
          try {
            await firstValueFrom(
              this.convoApi.addTurn(this.activeConversationId, {
                userMessage: text,
                botResponse: reply,
              }).pipe(timeout(120000))
            );
          } catch (turnErr) {
            // ✅ If backend says "Conversation not found", reset and create next time
            console.error('addTurn failed, resetting activeConversationId', turnErr);
            this.activeConversationId = null;
            localStorage.removeItem('activeConversationId');
            // we won't retry in same send (prevents double-saving)
          }
        }
      }
    } catch (e) {
      const err = e as any;

      let msg = '⚠️ Request failed.';
      if (err?.name === 'TimeoutError') msg = '⚠️ Timed out. Server took too long.';
      if (err instanceof HttpErrorResponse) {
        msg = `⚠️ HTTP ${err.status}: ${err.statusText}`;
      }

      this.messages.push({ role: 'ai', text: msg });
    } finally {
      this.sending = false;
      this.cdr.detectChanges();
      this.scrollToBottom();
    }
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      const el = document.querySelector('.chat__messages') as HTMLElement | null;
      if (el) el.scrollTop = el.scrollHeight;
    }, 0);
  }

  private extractConversationId(obj: any): string | null {
    if (!obj) return null;
    return (
      obj.id ||
      obj._id ||
      obj.conversationId ||
      obj.conversationID ||
      obj.conversation_id ||
      null
    );
  }

  async exportConversationPdf() {
    if (!this.messages || this.messages.length === 0) {
      alert('No conversation to export yet.');
      return;
    }

    const doc = new jsPDF({ unit: 'pt', format: 'a4' });

    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    const margin = 56;
    const topMargin = 56;
    const bottomMargin = 70;

    const logoDataUrl = await this.loadImageAsDataURL('assets/emman.png');

    const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    const formatHHMM = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

    const dateIssuedText = new Date().toLocaleDateString('en-US', {
      month: 'long',
      day: '2-digit',
      year: 'numeric',
    });

    const footerNote =
      'Note: This transcript is generated for documentation purposes only. Personal identifiers are excluded in compliance with applicable data privacy regulations.';

    // ===== TABLE layout =====
    const tableX = margin;
    const tableW = pageW - margin * 2;
    const colTime = 70;
    const colSender = 90;
    const colMsg = tableW - colTime - colSender;

    const headerH = 28;
    const rowPadY = 8;
    const lineH = 14;

    // Draw header (logo + title + date + divider) on each page
    const drawHeader = () => {
      let y = topMargin;

      // Logo centered (header)
      const logoW = 140;
      const logoH = 46;
      const logoX = (pageW - logoW) / 2;

      if (logoDataUrl) {
        doc.addImage(logoDataUrl, 'PNG', logoX, y - 8, logoW, logoH);
      }
      y += 60;

      // Title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(0);
      doc.text('Conversation Transcript', margin, y);
      y += 18;

      // Date issued
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(80);
      doc.text(`Date Issued: ${dateIssuedText}`, margin, y);
      doc.setTextColor(0);
      y += 14;

      // Divider
      doc.setDrawColor(210);
      doc.line(margin, y, pageW - margin, y);
      y += 18;

      return y; // returns start Y for table area
    };

    const drawFooter = () => {
      // Footer divider line
      doc.setDrawColor(210);
      doc.line(margin, pageH - bottomMargin + 18, pageW - margin, pageH - bottomMargin + 18);

      // Footer note text near bottom
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(90);

      const lines = doc.splitTextToSize(footerNote, pageW - margin * 2);
      let fy = pageH - bottomMargin + 36;

      for (const line of lines) {
        if (fy > pageH - 18) break; // safety
        doc.text(line, margin, fy);
        fy += 12;
      }

      doc.setTextColor(0);
    };

    let y = drawHeader();

    const drawTableHeader = () => {
      doc.setFillColor(242, 242, 242);
      doc.setDrawColor(230);
      doc.rect(tableX, y, tableW, headerH, 'FD');

      doc.line(tableX + colTime, y, tableX + colTime, y + headerH);
      doc.line(tableX + colTime + colSender, y, tableX + colTime + colSender, y + headerH);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(60);

      doc.text('Time', tableX + 10, y + 18);
      doc.text('Sender', tableX + colTime + 10, y + 18);
      doc.text('Message', tableX + colTime + colSender + 10, y + 18);

      doc.setTextColor(0);
      y += headerH;
    };

    const startNewPage = () => {
      // finish current page footer
      drawFooter();

      doc.addPage();
      y = drawHeader();
      drawTableHeader();
    };

    const ensureSpace = (needed: number) => {
      if (y + needed > pageH - bottomMargin) {
        startNewPage();
      }
    };

    drawTableHeader();

    // synthetic time (since ChatMsg has no createdAt)
    const baseTime = new Date();
    baseTime.setSeconds(0, 0);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    for (let i = 0; i < this.messages.length; i++) {
      const m = this.messages[i]; // ChatMsg
      const sender = m.role === 'user' ? 'User' : 'Emman'; // ✅ Assistant -> Emman
      const msgText = (m.text ?? '').trim();
      if (!msgText) continue;

      const t = new Date(baseTime.getTime() + i * 60_000);
      const timeStr = formatHHMM(t);

      const msgLines = doc.splitTextToSize(msgText, colMsg - 20);
      const rowH = Math.max(headerH, msgLines.length * lineH + rowPadY * 2);

      ensureSpace(rowH + 2);

      doc.setDrawColor(230);
      doc.rect(tableX, y, tableW, rowH);

      doc.line(tableX + colTime, y, tableX + colTime, y + rowH);
      doc.line(tableX + colTime + colSender, y, tableX + colTime + colSender, y + rowH);

      const textY = y + rowPadY + 11;

      doc.setTextColor(0);
      doc.text(timeStr, tableX + 10, textY);
      doc.text(sender, tableX + colTime + 10, textY);

      let ly = textY;
      for (const line of msgLines) {
        doc.text(line, tableX + colTime + colSender + 10, ly);
        ly += lineH;
      }

      y += rowH;
    }

    // footer for the last page
    drawFooter();

    doc.save(`conversation-${Date.now()}.pdf`);
  }

  private async loadImageAsDataURL(url: string): Promise<string | null> {
    try {
      const res = await fetch(url);
      const blob = await res.blob();

      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('FileReader error'));
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.warn('Logo load failed:', e);
      return null;
    }
  }
}
