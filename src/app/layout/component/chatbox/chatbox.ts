import { Component, ChangeDetectorRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { timeout } from 'rxjs/operators';

type ChatMsg = { role: 'user' | 'ai'; text: string };

@Component({
  selector: 'app-chatbox',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './chatbox.html',
  styleUrls: ['./chatbox.scss'],
})
export class Chatbox implements OnInit {
  message = '';
  sending = false;

  messages: ChatMsg[] = [{ role: 'ai', text: 'Hi! Ask me anything.' }];

  // ✅ keep this (since curl works)
  private readonly API_URL = 'http://localhost:8080/api/chat';

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.sending = false;
  }

  async sendMessage() {
    const text = this.message.trim();
    if (!text || this.sending) return;

    // push user msg
    this.messages.push({ role: 'user', text });
    this.message = '';

    // show typing
    this.sending = true;
    this.scrollToBottom();

    try {
      console.log('[chat] POST:', this.API_URL, 'payload:', { message: text });

      const res = await firstValueFrom(
        this.http
          .post<{ reply: string }>(this.API_URL, { message: text })
          .pipe(timeout(120000)) // 2 minutes
      );

      console.log('[chat] response:', res);

      const reply = (res?.reply ?? '').trim();
      this.messages.push({ role: 'ai', text: reply || '(Empty reply)' });
    } catch (e) {
      const err = e as any;

      console.error('[chat] error:', err);

      let msg = '⚠️ Request failed.';
      // timeout operator throws TimeoutError with name = 'TimeoutError'
      if (err?.name === 'TimeoutError') msg = '⚠️ Timed out. Server took too long.';
      if (err instanceof HttpErrorResponse) msg = `⚠️ HTTP ${err.status}: ${err.statusText}`;

      this.messages.push({ role: 'ai', text: msg });
    } finally {
      // ✅ ALWAYS stop typing
      this.sending = false;

      // ✅ force UI refresh (prevents “stuck typing” visual)
      this.cdr.detectChanges();

      this.scrollToBottom();
      console.log('[chat] sending=false');
    }
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      const el = document.querySelector('.chat__messages') as HTMLElement | null;
      if (el) el.scrollTop = el.scrollHeight;
    }, 0);
  }
}
