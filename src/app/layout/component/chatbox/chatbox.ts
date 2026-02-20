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

    this.chats = (list || [])
      .filter((c: any) => !c.archived) // ✅ hide archived chats
      .map((c: any) => ({
        id: this.extractConversationId(c) || '',
        title: c.title || '(Untitled)',
      }))
      .filter(x => !!x.id);

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
  async onDeleteChat(conversationId: string) {
  const id = this.normalizeId(conversationId);
  if (!id) return;

  const ok = confirm('Delete this chat?');
  if (!ok) {
    this.cdr.detectChanges();
    return;
  }

  try {
    await firstValueFrom(this.convoApi.deleteConversation(id).pipe(timeout(120000)));

    // ✅ update sidebar list
    this.chats = this.chats.filter(c => c.id !== id);

    // ✅ if the deleted chat is currently open, reset the chat UI
    if (this.activeConversationId === id) {
      this.activeConversationId = null;
      localStorage.removeItem('activeConversationId');
      this.messages = [];
      this.message = '';
      this.sending = false;
    }

    this.cdr.detectChanges();
  } catch (e) {
    console.error('Delete failed', e);
    alert('Failed to delete conversation in database.');
  }
}

// OPTIONAL: if you want archive too
async onArchiveChat(conversationId: string) {
  const id = this.normalizeId(conversationId);
  if (!id) return;

  try {
    await firstValueFrom(
      this.convoApi.archiveConversation(id).pipe(timeout(120000))
    );

    // ✅ Remove from sidebar immediately
    this.chats = this.chats.filter(c => c.id !== id);

    // ✅ If archived chat is currently open, reset chat view
    if (this.activeConversationId === id) {
      this.activeConversationId = null;
      localStorage.removeItem('activeConversationId');
      this.messages = [];
      this.message = '';
      this.sending = false;
    }

    this.cdr.detectChanges();
  } catch (e) {
    console.error('Archive failed', e);
    alert('Failed to archive conversation.');
  }
}

showArchiveModal = false;

openArchiveModal() {
  this.showArchiveModal = true;
}

}


