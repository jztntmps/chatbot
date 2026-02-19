import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Conversation {
  id?: string;
  _id?: string;
  userId: string;
  title?: string;
  status?: string;
  archivedAt?: string | null;
  createdAt?: string;
  turns?: { userMessage: string; botResponse: string }[];
}

@Injectable({ providedIn: 'root' })
export class ConversationService {
  private baseUrl = 'http://localhost:8080/api/conversations';

  constructor(private http: HttpClient) {}

  getByUser(userId: string): Observable<Conversation[]> {
    return this.http.get<Conversation[]>(`${this.baseUrl}/by-user/${userId}`);
  }

  createConversation(payload: {
    userId: string;
    firstUserMessage: string;
    firstBotResponse: string;
  }): Observable<Conversation> {
    return this.http.post<Conversation>(this.baseUrl, payload);
  }

  addTurn(conversationId: string, payload: {
    userMessage: string;
    botResponse: string;
  }): Observable<Conversation> {
    return this.http.post<Conversation>(`${this.baseUrl}/${conversationId}/turns`, payload);
  }
}
