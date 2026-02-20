import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Conversation {
  id?: string;
  _id?: string;
  conversationId?: string;

  userId: string;
  title?: string;
  status?: string;

  archived?: boolean;
  createdAt?: string;

  turns?: { userMessage: string; botResponse: string }[];
}

@Injectable({ providedIn: 'root' })
export class ConversationService {
  private readonly baseUrl = 'http://localhost:8080/api/conversations';

  constructor(private http: HttpClient) {}

  // ✅ list (you can filter archived on frontend or add a backend endpoint)
  getByUser(userId: string): Observable<Conversation[]> {
    return this.http.get<Conversation[]>(`${this.baseUrl}/by-user/${userId}`);
  }

  // ✅ create convo (first turn)
  createConversation(payload: {
    userId: string;
    firstUserMessage: string;
    firstBotResponse: string;
  }): Observable<Conversation> {
    return this.http.post<Conversation>(this.baseUrl, payload);
  }

  // ✅ add turn
  addTurn(
    conversationId: string,
    payload: { userMessage: string; botResponse: string }
  ): Observable<Conversation> {
    return this.http.post<Conversation>(
      `${this.baseUrl}/${conversationId}/turns`,
      payload
    );
  }

  // ✅ get single conversation
  getConversation(conversationId: string): Observable<Conversation> {
    return this.http.get<Conversation>(`${this.baseUrl}/${conversationId}`);
  }

  // ✅ delete conversation in DB
  deleteConversation(conversationId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${conversationId}`);
  }

  // ✅ archive (sets archived=true)
  archiveConversation(conversationId: string): Observable<Conversation> {
    return this.http.patch<Conversation>(
      `${this.baseUrl}/${conversationId}/archive`,
      {}
    );
  }

  // ✅ unarchive (sets archived=false) — add backend endpoint /unarchive
  unarchiveConversation(conversationId: string): Observable<Conversation> {
    return this.http.patch<Conversation>(
      `${this.baseUrl}/${conversationId}/unarchive`,
      {}
    );
  }
}

