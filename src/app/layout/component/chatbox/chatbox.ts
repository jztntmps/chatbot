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
  chats: ChatPreview[] = [
    { id: '1', title: '...' },
    { id: '2', title: '...' },
    { id: '3', title: '...' },
  ];

  // chat
  message = '';
  sending = false;
  messages: ChatMsg[] = [];

  private readonly API_URL = 'http://localhost:8080/api/chat';

  private navSub?: Subscription;

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private router: Router
  ) {}

  ngOnInit(): void {
    // ✅ first sync when component loads
    this.syncAuth();

    // ✅ sync again whenever route changes to /chatbox
    this.navSub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        if (e.urlAfterRedirects.includes('/chatbox')) {
          this.syncAuth();
        }
      });
  }

  ngOnDestroy(): void {
    this.navSub?.unsubscribe();
  }

  private syncAuth() {
    const saved = localStorage.getItem('isLoggedIn');

    // if no flag exists, treat as NOT logged in
    this.isLoggedIn = saved === 'true';
    this.userEmail = localStorage.getItem('userEmail') || 'User';

    this.cdr.detectChanges();
  }

  // ✅ sidebar actions
  toggleSidebar() {
    this.sidebarOpen = !this.sidebarOpen;
    console.log('[chatbox] sidebarOpen:', this.sidebarOpen);
    this.cdr.detectChanges();
  }

  openChat(chatId: string) {
    console.log('Open chat:', chatId);
  }
  seeAll() {
    console.log('See all chats');
  }
  openSettings() {
    console.log('Open settings');
  }

  // ✅ existing actions
  startNewChat() {
    this.messages = [{ role: 'ai', text: 'Hi! Ask me anything.' }];
    this.message = '';
    this.sending = false;
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
  // later: this.router.navigate(['/archive']);
}


  logout() {
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('userEmail');
    this.syncAuth();
    this.router.navigate(['/']);
  }

  async sendMessage() {
    const text = this.message.trim();
    if (!text || this.sending) return;

    this.messages.push({ role: 'user', text });
    this.message = '';

    this.sending = true;
    this.scrollToBottom();

    try {
      const res = await firstValueFrom(
        this.http
          .post<{ reply: string }>(this.API_URL, { message: text })
          .pipe(timeout(120000))
      );

      const reply = (res?.reply ?? '').trim();
      this.messages.push({ role: 'ai', text: reply || '(Empty reply)' });
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

  
}
