import { Component, ChangeDetectorRef, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, NavigationEnd } from '@angular/router';
import { HttpClient, HttpClientModule, HttpErrorResponse } from '@angular/common/http';

import { Topbar } from '../topbar/topbar';
import { FooterComponent } from '../footer/footer';
import { SidebarComponent } from '../sidebar/sidebar';

import { ConversationService } from '../../../services/conversation';
import { UiModalService } from '../../../shared/ui-modal/ui-modal.service';
import { firstValueFrom, Subscription } from 'rxjs';
import { filter, timeout } from 'rxjs/operators';
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

  // ✅ edit mode state
  editingIndex: number | null = null;
  editingText: string = '';
  private originalEditText = '';

  /** ✅ Auto-grow textarea height while editing bubble */
  autoGrow(ev: Event) {
    const ta = ev.target as HTMLTextAreaElement;
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 'px';
  }

  listening = false;
  private recognition: any;
  // ✅ cancel in-flight AI request
  private inflightChatSub?: Subscription;

  // ✅ conversation tracking
  userId = '';
  activeConversationId: string | null = null;

  private readonly API_URL = 'http://localhost:8080/api/chat';
  private readonly CONVO_BASE = 'http://localhost:8080/api/conversations';

  private navSub?: Subscription;
  private warnedNoSave = false;
  private requestToken = 0;

  // ✅ session key
  private readonly SS_ACTIVE_CONVO = 'activeConversationId';

  // archive modal
  showArchiveModal = false;

  constructor(
    private http: HttpClient,
    private convoApi: ConversationService,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private uiModal: UiModalService
  ) {}

  ngOnInit(): void {
    this.syncAuth();

    // ✅ IMPORTANT:
    // Only when LOGGED IN -> restore last active conversation after reload.
    // If NOT logged in -> do NOTHING (no changes in guest behavior).
    if (this.isLoggedIn && this.activeConversationId) {
      this.openChat(this.activeConversationId);
    }

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
    this.inflightChatSub?.unsubscribe();
  }

  private syncAuth() {
    const saved = sessionStorage.getItem('isLoggedIn');

    this.isLoggedIn = saved === 'true' || saved === '1';
    this.userEmail = sessionStorage.getItem('userEmail') || 'Guest';
    this.userId = sessionStorage.getItem('userId') || '';

    const savedConvoIdRaw = sessionStorage.getItem(this.SS_ACTIVE_CONVO);
    const savedConvoId = this.normalizeId(savedConvoIdRaw);
    this.activeConversationId = this.isLoggedIn ? savedConvoId : null;

    if (this.isLoggedIn && this.userId) {
      this.loadConversations();
    } else {
      // ✅ Guest mode: allow chat, but no saved conversations
      // (NO reset of messages here — keep current behavior)
      this.chats = [];
      this.activeConversationId = null;
      sessionStorage.removeItem(this.SS_ACTIVE_CONVO);
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

      this.chats = (list || [])
        .filter((c: any) => !c.archived)
        .map((c: any) => ({
          id: this.extractConversationId(c) || '',
          title: c.title || '(Untitled)',
        }))
        .filter((x) => !!x.id);

      this.cdr.detectChanges();
    } catch (e) {
      console.error('Failed to load conversations', e);
      this.chats = [];
      this.cdr.detectChanges();
    }
  }

  toggleSidebar() {
    this.sidebarOpen = !this.sidebarOpen;
    this.cdr.detectChanges();
  }

  async openChat(chatId: string) {
    const normalized = this.normalizeId(chatId);
    if (!normalized) return;

    // stop any in-flight response when switching chats
    this.stopGeneration(false);

    // exit edit mode
    this.cancelEdit(false);

    try {
      const convo = await firstValueFrom(
        this.http.get<any>(`${this.CONVO_BASE}/${normalized}`).pipe(timeout(120000))
      );

      this.activeConversationId = this.extractConversationId(convo) || normalized;

      // ✅ save only if logged in
      if (this.isLoggedIn && this.activeConversationId) {
        sessionStorage.setItem(this.SS_ACTIVE_CONVO, this.activeConversationId);
      }

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

      this.activeConversationId = null;
      sessionStorage.removeItem(this.SS_ACTIVE_CONVO);

      this.messages.push({
        role: 'ai',
        text: '⚠️ Failed to open conversation (maybe deleted). Starting a new chat.',
      });

      this.scrollToBottom();
      this.cdr.detectChanges();
    }
  }

  seeAll() {}
  openSettings() {}

  startNewChat() {
    // stop generation + exit edit mode
    this.stopGeneration(false);
    this.cancelEdit(false);

    this.messages = [{ role: 'ai', text: 'Hi! Ask me anything.' }];
    this.message = '';
    this.sending = false;

    this.activeConversationId = null;
    sessionStorage.removeItem(this.SS_ACTIVE_CONVO);

    this.scrollToBottom();
    this.cdr.detectChanges();
  }

  goLogin() {
    this.router.navigate(['/indexlogin']);
  }

  goSignup() {
    this.router.navigate(['/signup']);
  }

  goArchive() {
    this.openArchiveModal();
  }

  logout() {
    // ✅ Clear session so user is not logged in after logout
    sessionStorage.clear();
    this.syncAuth();
    this.router.navigate(['/']);
  }

  // ==========================================
  // ✅ NEW: submit handler (send OR edit resend)
  // ==========================================
  onSubmit() {
    // can type anytime, but cannot send while generating
    if (this.sending) return;

    // if editing -> Save & Resend
    if (this.editingIndex !== null) {
      this.saveEditAndResend();
      return;
    }

    // normal send
    this.sendMessage();
  }

  // ==========================================
  // ✅ UPDATED: sendMessage now supports cancel
  // ==========================================
  async sendMessage() {
    const text = this.message.trim();
    if (!text || this.sending) return;

    const canSave = this.isLoggedIn && !!this.userId;

    // ✅ unique token per request
    const myToken = ++this.requestToken;

    // ✅ snapshot current conversation id at send time
    const convoAtSend = this.normalizeId(this.activeConversationId);

    if (!canSave && !this.warnedNoSave) {
      this.warnedNoSave = true;
      this.messages.push({
        role: 'ai',
        text: '⚠️ You are in Guest Mode. Messages will work, but they won’t be saved. Login to save conversations.',
      });
    }

    // push user msg
    this.messages.push({ role: 'user', text });

    // clear input but user can type again
    this.message = '';
    this.sending = true;
    this.scrollToBottom();
    this.cdr.detectChanges();

    // =========================
    // 1) CHAT (Cancelable) request
    // =========================
    let reply = '';
    try {
      reply = await new Promise<string>((resolve, reject) => {
        this.inflightChatSub?.unsubscribe();

        this.inflightChatSub = this.http
        .post<{ reply: string }>(this.API_URL, {
          message: text,
          userId: this.isLoggedIn ? this.userId : null,
          conversationId: this.isLoggedIn ? this.activeConversationId : null,
        })
        .pipe(timeout(120000))
        .subscribe({
          next: (res) => resolve((res?.reply ?? '').trim() || '(Empty reply)'),
          error: (err) => reject(err),
        });
      });

      // ✅ if stopped or a newer request started, ignore
      if (!this.sending || myToken !== this.requestToken) return;

      // ✅ if user switched conversations while waiting, ignore
      if (this.normalizeId(this.activeConversationId) !== convoAtSend) {
        this.sending = false;
        this.cdr.detectChanges();
        return;
      }

      this.messages.push({ role: 'ai', text: reply });
    } catch (e) {
      if (!this.sending || myToken !== this.requestToken) return;

      // if user switched conversation, ignore the error bubble too
      if (this.normalizeId(this.activeConversationId) !== convoAtSend) {
        this.sending = false;
        this.cdr.detectChanges();
        return;
      }

      const err = e as any;
      let msg = '⚠️ Request failed.';
      if (err?.name === 'TimeoutError') msg = '⚠️ Timed out. Server took too long.';
      if (err instanceof HttpErrorResponse) msg = `⚠️ HTTP ${err.status}: ${err.statusText}`;

      this.messages.push({ role: 'ai', text: msg });
      this.sending = false;
      this.cdr.detectChanges();
      this.scrollToBottom();
      return;
    }

    // =========================
    // 2) SAVE (DB) request
    // =========================
    if (canSave) {
      try {
        if (myToken !== this.requestToken) throw new Error('stale request');
        if (this.normalizeId(this.activeConversationId) !== convoAtSend)
          throw new Error('switched chat');

        let convoId = this.normalizeId(this.activeConversationId);

        if (!convoId) {
          const created = await firstValueFrom(
            this.convoApi
              .createConversation({
                userId: this.userId,
                firstUserMessage: text,
                firstBotResponse: reply,
              })
              .pipe(timeout(120000))
          );

          convoId = this.normalizeId(this.extractConversationId(created));

          if (myToken === this.requestToken && this.normalizeId(this.activeConversationId) === convoAtSend) {
            this.activeConversationId = convoId;

            // ✅ store active convo only for logged in
            if (convoId) sessionStorage.setItem(this.SS_ACTIVE_CONVO, convoId);

            this.loadConversations();
          }
        } else {
          await firstValueFrom(
            this.convoApi
              .addTurn(convoId, {
                userMessage: text,
                botResponse: reply,
              })
              .pipe(timeout(120000))
          );
        }
      } catch (saveErr) {
        console.warn('Save skipped/failed:', saveErr);
      }
    }

    if (myToken === this.requestToken) {
      this.sending = false;
      this.cdr.detectChanges();
      this.scrollToBottom();
    }
  }

  // ==========================================
  // ✅ Stop generation (cancel request)
  // ==========================================
  stopGeneration(openEditLast: boolean = true) {
    this.inflightChatSub?.unsubscribe();
    this.inflightChatSub = undefined;

    this.sending = false;

    if (openEditLast && this.editingIndex === null) {
      const idx = this.findLastUserIndex();
      if (idx !== null) this.startEditUserMessage(idx);
    }

    this.cdr.detectChanges();
  }

  // ==========================================
  // ✅ Edit + Copy helpers
  // ==========================================
  startEditUserMessage(index: number) {
    if (this.editingIndex !== null && this.editingIndex !== index) return;
    if (this.messages[index]?.role !== 'user') return;

    if (this.sending) this.stopGeneration(false);

    this.editingIndex = index;
    this.originalEditText = this.messages[index].text;
    this.editingText = this.messages[index].text;

    this.cdr.detectChanges();
  }

  cancelEdit(clearText: boolean = true) {
    this.editingIndex = null;
    this.editingText = '';
    this.originalEditText = '';

    if (clearText) this.message = '';

    this.cdr.detectChanges();
  }

  saveEditAndResend() {
    if (this.editingIndex === null) return;

    const newText = this.editingText.trim();
    if (!newText) return;

    this.messages[this.editingIndex].text = newText;
    this.messages = this.messages.slice(0, this.editingIndex + 1);

    this.editingIndex = null;
    this.editingText = '';
    this.originalEditText = '';

    this.cdr.detectChanges();
    this.scrollToBottom();

    this.startBotResponseForEditedMessage(newText);
  }

  private async startBotResponseForEditedMessage(text: string) {
    if (this.sending) return;

    this.sending = true;
    this.scrollToBottom();
    this.cdr.detectChanges();

    const canSave = this.isLoggedIn && !!this.userId;

    let reply = '';
    try {
      reply = await new Promise<string>((resolve, reject) => {
        this.inflightChatSub?.unsubscribe();

        this.inflightChatSub = this.http
          .post<{ reply: string }>(this.API_URL, { message: text })
          .pipe(timeout(120000))
          .subscribe({
            next: (res) => resolve((res?.reply ?? '').trim() || '(Empty reply)'),
            error: (err) => reject(err),
          });
      });

      if (!this.sending) return;

      this.messages.push({ role: 'ai', text: reply });
    } catch (e) {
      if (!this.sending) return;

      const err = e as any;
      let msg = '⚠️ Request failed.';
      if (err?.name === 'TimeoutError') msg = '⚠️ Timed out. Server took too long.';
      if (err instanceof HttpErrorResponse) {
        msg = `⚠️ HTTP ${err.status}: ${err.statusText}`;
      }
      this.messages.push({ role: 'ai', text: msg });

      this.sending = false;
      this.cdr.detectChanges();
      this.scrollToBottom();
      return;
    }

    if (canSave) {
      try {
        this.activeConversationId = this.normalizeId(this.activeConversationId);

        if (!this.activeConversationId) {
          const created = await firstValueFrom(
            this.convoApi
              .createConversation({
                userId: this.userId,
                firstUserMessage: text,
                firstBotResponse: reply,
              })
              .pipe(timeout(120000))
          );

          const convoId = this.extractConversationId(created);
          this.activeConversationId = this.normalizeId(convoId);

          if (this.activeConversationId) {
            sessionStorage.setItem(this.SS_ACTIVE_CONVO, this.activeConversationId);
          }

          this.loadConversations();
        } else {
          await firstValueFrom(
            this.convoApi
              .addTurn(this.activeConversationId, {
                userMessage: text,
                botResponse: reply,
              })
              .pipe(timeout(120000))
          );
        }
      } catch (saveErr) {
        console.warn('Save failed (chat still works):', saveErr);
      }
    }

    this.sending = false;
    this.cdr.detectChanges();
    this.scrollToBottom();
  }

  async copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
  }

  private findLastUserIndex(): number | null {
    for (let i = this.messages.length - 1; i >= 0; i--) {
      if (this.messages[i].role === 'user') return i;
    }
    return null;
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

async onDeleteChat(conversationId: string) {
  const id = this.normalizeId(conversationId);
  if (!id) return;

  try {
    await firstValueFrom(this.convoApi.deleteConversation(id).pipe(timeout(120000)));

    // remove from sidebar list
    this.chats = this.chats.filter((c) => c.id !== id);

    // if currently open chat is deleted, reset UI
    if (this.activeConversationId === id) {
      this.activeConversationId = null;
      sessionStorage.removeItem(this.SS_ACTIVE_CONVO);

      this.messages = [];
      this.message = '';
      this.sending = false;
    }

    this.cdr.detectChanges();

    await this.uiModal.notify({
      title: 'Deleted',
      message: 'Chat deleted successfully.',
      variant: 'success',
      icon: 'success',
      autoCloseMs: 3000,
    });
  } catch (e) {
    console.error('Delete failed', e);

    // still reset UI if it was the active one (optional but safe)
    if (this.activeConversationId === id) {
      this.activeConversationId = null;
      sessionStorage.removeItem(this.SS_ACTIVE_CONVO);

      this.messages = [];
      this.message = '';
      this.sending = false;
    }

    this.cdr.detectChanges();

    await this.uiModal.notify({
      title: 'Delete failed',
      message: 'Failed to delete conversation in database.',
      variant: 'danger',
      icon: 'warning',
      autoCloseMs: 3000,
    });
  }
}

  // ===============================
  // ✅ PDF export (UNCHANGED BELOW)
  // ===============================
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

    const tableX = margin;
    const tableW = pageW - margin * 2;
    const colTime = 70;
    const colSender = 90;
    const colMsg = tableW - colTime - colSender;

    const headerH = 28;
    const rowPadY = 8;
    const lineH = 14;

    const drawHeader = () => {
      let y = topMargin;

      const logoW = 140;
      const logoH = 46;
      const logoX = (pageW - logoW) / 2;

      if (logoDataUrl) {
        doc.addImage(logoDataUrl, 'PNG', logoX, y - 8, logoW, logoH);
      }
      y += 60;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(0);
      doc.text('Conversation Transcript', margin, y);
      y += 18;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(80);
      doc.text(`Date Issued: ${dateIssuedText}`, margin, y);
      doc.setTextColor(0);
      y += 14;

      doc.setDrawColor(210);
      doc.line(margin, y, pageW - margin, y);
      y += 18;

      return y;
    };

    const drawFooter = () => {
      doc.setDrawColor(210);
      doc.line(margin, pageH - bottomMargin + 18, pageW - margin, pageH - bottomMargin + 18);

      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(90);

      const lines = doc.splitTextToSize(footerNote, pageW - margin * 2);
      let fy = pageH - bottomMargin + 36;

      for (const line of lines) {
        if (fy > pageH - 18) break;
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

    const baseTime = new Date();
    baseTime.setSeconds(0, 0);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    for (let i = 0; i < this.messages.length; i++) {
      const m = this.messages[i];
      const sender = m.role === 'user' ? 'User' : 'Emman';
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

async onArchiveChat(conversationId: string) {
  const id = this.normalizeId(conversationId);
  if (!id) return;

  try {
    await firstValueFrom(this.convoApi.archiveConversation(id).pipe(timeout(120000)));

    // remove from sidebar list (archived chats should disappear)
    this.chats = this.chats.filter((c) => c.id !== id);

    // if currently open chat is archived, reset UI
    if (this.activeConversationId === id) {
      this.activeConversationId = null;
      sessionStorage.removeItem(this.SS_ACTIVE_CONVO);

      this.messages = [];
      this.message = '';
      this.sending = false;
    }

    this.cdr.detectChanges();

    await this.uiModal.notify({
      title: 'Archived',
      message: 'Chat moved to Archived Chats.',
      variant: 'success',
      icon: 'success',
      autoCloseMs: 3000,
    });
  } catch (e) {
    console.error('Archive failed', e);
    this.cdr.detectChanges();

    await this.uiModal.notify({
      title: 'Archive failed',
      message: 'Failed to archive conversation.',
      variant: 'danger',
      icon: 'warning',
      autoCloseMs: 3000,
    });
  }
}

  openArchiveModal() {
    this.showArchiveModal = true;
    this.cdr.detectChanges();
  }

  closeArchiveModal() {
    this.showArchiveModal = false;
    this.cdr.detectChanges();
  }

  async onExportChat(conversationId: string) {
    const id = this.normalizeId(conversationId);
    if (!id) return;

    try {
      const convo = await firstValueFrom(
        this.http.get<any>(`${this.CONVO_BASE}/${id}`).pipe(timeout(120000))
      );

      const turns = convo?.turns || [];
      const rebuilt: ChatMsg[] = [];

      for (const t of turns) {
        if (t?.userMessage) rebuilt.push({ role: 'user', text: t.userMessage });
        if (t?.botResponse) rebuilt.push({ role: 'ai', text: t.botResponse });
      }

      if (!rebuilt.length) {
        alert('No messages to export in this conversation.');
        return;
      }

      const title =
        (convo?.title || this.chats.find((c) => c.id === id)?.title || 'conversation').trim();

      await this.exportConversationPdfForMessages(rebuilt, title);
    } catch (e) {
      console.error('Export failed', e);
      alert('Failed to export. Please try again.');
    }
  }

  private sanitizeFilename(name: string) {
    return name
      .replace(/[\/\\?%*:|"<>]/g, '-')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 60);
  }

  private async exportConversationPdfForMessages(msgs: ChatMsg[], title: string) {
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

    const tableX = margin;
    const tableW = pageW - margin * 2;
    const colTime = 70;
    const colSender = 90;
    const colMsg = tableW - colTime - colSender;

    const headerH = 28;
    const rowPadY = 8;
    const lineH = 14;

    const drawHeader = () => {
      let y = topMargin;

      const logoW = 140;
      const logoH = 46;
      const logoX = (pageW - logoW) / 2;

      if (logoDataUrl) doc.addImage(logoDataUrl, 'PNG', logoX, y - 8, logoW, logoH);
      y += 60;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text('Conversation Transcript', margin, y);
      y += 18;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(80);
      doc.text(`Title: ${title}`, margin, y);
      y += 14;

      doc.text(`Date Issued: ${dateIssuedText}`, margin, y);
      doc.setTextColor(0);
      y += 14;

      doc.setDrawColor(210);
      doc.line(margin, y, pageW - margin, y);
      y += 18;

      return y;
    };

    const drawFooter = () => {
      doc.setDrawColor(210);
      doc.line(margin, pageH - bottomMargin + 18, pageW - margin, pageH - bottomMargin + 18);

      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(90);

      const lines = doc.splitTextToSize(footerNote, pageW - margin * 2);
      let fy = pageH - bottomMargin + 36;

      for (const line of lines) {
        if (fy > pageH - 18) break;
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
      drawFooter();
      doc.addPage();
      y = drawHeader();
      drawTableHeader();
    };

    const ensureSpace = (needed: number) => {
      if (y + needed > pageH - bottomMargin) startNewPage();
    };

    drawTableHeader();

    const baseTime = new Date();
    baseTime.setSeconds(0, 0);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    for (let i = 0; i < msgs.length; i++) {
      const m = msgs[i];
      const sender = m.role === 'user' ? 'User' : 'Emman';
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

    drawFooter();

    const safeTitle = this.sanitizeFilename(title || 'conversation');
    doc.save(`${safeTitle}.pdf`);
  }

  toggleVoice() {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser.');
      return;
    }

    if (!this.recognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.lang = 'en-US';
      this.recognition.continuous = false;
      this.recognition.interimResults = false;

      this.recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        this.message = transcript;
        this.cdr.detectChanges();
      };

      this.recognition.onend = () => {
        this.listening = false;
        this.cdr.detectChanges();
      };

      this.recognition.onerror = () => {
        this.listening = false;
        this.cdr.detectChanges();
      };
    }

    if (!this.listening) {
      this.recognition.start();
      this.listening = true;
    } else {
      this.recognition.stop();
      this.listening = false;
    }

    this.cdr.detectChanges();
  }

  reloadConversations() {
    if (this.isLoggedIn && this.userId) {
      this.loadConversations();
    }
  }
}