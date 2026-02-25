import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { timeout } from 'rxjs/operators';

import { FooterComponent } from '../footer/footer';
import { SidebarComponent } from '../sidebar/sidebar';
import { Topbar } from '../topbar/topbar';

import { ConversationService, Conversation } from '../../../services/conversation';

type ChatMsg = { role: 'user' | 'ai'; text: string };
type ChatPreview = { id: string; title: string };

@Component({
  selector: 'app-preview-archive',
  standalone: true,
  imports: [CommonModule, FormsModule, FooterComponent, SidebarComponent, Topbar],
  templateUrl: './preview-archive.html',
  styleUrls: ['./preview-archive.scss'],
})
export class PreviewArchive implements OnInit {
  isLoggedIn = false;
  sidebarOpen = true;

  userEmail = 'User';
  userId = '';

  chats: ChatPreview[] = [];

  conversationId: string | null = null;
  messages: ChatMsg[] = [];
  loading = false;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private convoApi: ConversationService,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    // optional: keep your auth consistent
    const saved = localStorage.getItem('isLoggedIn');
    this.isLoggedIn = saved === 'true' || saved === '1';
    this.userEmail = localStorage.getItem('userEmail') || 'User';
    this.userId = localStorage.getItem('userId') || '';

    // read query param
    this.conversationId = this.route.snapshot.queryParamMap.get('id');

    // load sidebar list (optional)
    if (this.isLoggedIn && this.userId) {
      await this.loadConversations();
    }

    // load the archived convo
    if (this.conversationId) {
      await this.loadConversation(this.conversationId);
    }
  }

  private normalizeId(id: string | null): string | null {
    if (!id) return null;
    const v = id.trim();
    if (!v || v === 'null' || v === 'undefined') return null;
    return v;
  }

  private extractConversationId(obj: any): string | null {
    return (
      obj?.id ||
      obj?._id ||
      obj?.conversationId ||
      obj?.conversationID ||
      obj?.conversation_id ||
      null
    );
  }

  async loadConversations() {
    try {
      const list = await firstValueFrom(
        this.convoApi.getByUser(this.userId).pipe(timeout(120000))
      );

      // show only non-archived on sidebar (same behavior as chatbox)
      /* c8 ignore start */
      this.chats = (list || [])
      /* c8 ignore stop */
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

  async loadConversation(id: string) {
    const normalized = this.normalizeId(id);
    if (!normalized) return;

    this.loading = true;
    this.cdr.detectChanges();

    try {
      // ✅ use getConversation() from your service
      const convo: Conversation = await firstValueFrom(
        this.convoApi.getConversation(normalized).pipe(timeout(120000))
      );
      /* c8 ignore start */
      const turns = convo?.turns || [];
      /* c8 ignore stop */
      const rebuilt: ChatMsg[] = [];

      for (const t of turns) {
        if (t?.userMessage) rebuilt.push({ role: 'user', text: t.userMessage });
        if (t?.botResponse) rebuilt.push({ role: 'ai', text: t.botResponse });
      }

      this.messages = rebuilt;
      this.cdr.detectChanges();
    } catch (e) {
      console.error('Failed to load archived conversation', e);
      this.messages = [{ role: 'ai', text: '⚠️ Failed to load archived chat.' }];
      this.cdr.detectChanges();
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  // ✅ READ ONLY: if user clicks a chat from sidebar, open it normally
  openChat(id: string) {
    this.router.navigate(['/chatbox'], { queryParams: { id } });
  }

  startNewChat() {
    this.router.navigate(['/chatbox']);
  }

  seeAll() {}

  toggleSidebar() {
    this.sidebarOpen = !this.sidebarOpen;
    this.cdr.detectChanges();
  }

  goLogin() {
    this.router.navigate(['/indexlogin']);
  }

  goSignup() {
    this.router.navigate(['/signup']);
  }

  goArchive() {
    // already in archive preview; no-op
  }

  logout() {
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userId');
    localStorage.removeItem('activeConversationId');
    this.router.navigate(['/']);
  }

  // ✅ Unarchive then go back to chatbox and reopen it for messaging
  async unarchiveConversation() {
    if (!this.conversationId) return;

    try {
      await firstValueFrom(
        this.convoApi
          .unarchiveConversation(this.conversationId)
          .pipe(timeout(120000))
      );

      // save active convo so chatbox opens it even without query params (optional)
      localStorage.setItem('activeConversationId', this.conversationId);

      // go back to chatbox and open it
      this.router.navigate(['/chatbox'], { queryParams: { id: this.conversationId } });
    } catch (e) {
      console.error('Unarchive failed', e);
      alert('Failed to unarchive conversation.');
    }
  }
}