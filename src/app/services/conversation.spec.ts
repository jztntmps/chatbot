import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConversationService, Conversation } from './conversation';

describe('ConversationService (100%)', () => {
  let service: ConversationService;
  let httpMock: HttpTestingController;

  const baseUrl = 'http://localhost:8080/api/conversations';

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });

    service = TestBed.inject(ConversationService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('getByUser() should GET /by-user/:userId', () => {
    const userId = 'u123';

    let result: Conversation[] | undefined;
    service.getByUser(userId).subscribe((res) => (result = res));

    const req = httpMock.expectOne(`${baseUrl}/by-user/${userId}`);
    expect(req.request.method).toBe('GET');

    const mock: Conversation[] = [
      { id: 'c1', userId, title: 'A', archived: false },
      { id: 'c2', userId, title: 'B', archived: true },
    ];
    req.flush(mock);

    expect(result).toEqual(mock);
  });

  it('createConversation() should POST baseUrl with payload', () => {
    const payload = {
      userId: 'u1',
      firstUserMessage: 'hi',
      firstBotResponse: 'hello',
    };

    let result: Conversation | undefined;
    service.createConversation(payload).subscribe((res) => (result = res));

    const req = httpMock.expectOne(baseUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);

    const mock: Conversation = {
      id: 'c_new',
      userId: payload.userId,
      title: 'New Chat',
      turns: [{ userMessage: payload.firstUserMessage, botResponse: payload.firstBotResponse }],
    };
    req.flush(mock);

    expect(result).toEqual(mock);
  });

  it('addTurn() should POST /:conversationId/turns with payload', () => {
    const conversationId = 'cid1';
    const payload = { userMessage: 'u msg', botResponse: 'b msg' };

    let result: Conversation | undefined;
    service.addTurn(conversationId, payload).subscribe((res) => (result = res));

    const req = httpMock.expectOne(`${baseUrl}/${conversationId}/turns`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);

    const mock: Conversation = {
      id: conversationId,
      userId: 'u1',
      turns: [{ userMessage: 'x', botResponse: 'y' }, payload],
    };
    req.flush(mock);

    expect(result).toEqual(mock);
  });

  it('getConversation() should GET /:conversationId', () => {
    const conversationId = 'cid2';

    let result: Conversation | undefined;
    service.getConversation(conversationId).subscribe((res) => (result = res));

    const req = httpMock.expectOne(`${baseUrl}/${conversationId}`);
    expect(req.request.method).toBe('GET');

    const mock: Conversation = {
      id: conversationId,
      userId: 'u2',
      title: 'Chat',
      turns: [{ userMessage: 'hi', botResponse: 'yo' }],
    };
    req.flush(mock);

    expect(result).toEqual(mock);
  });

  it('deleteConversation() should DELETE /:conversationId', () => {
    const conversationId = 'cid_del';

    let done = false;
    service.deleteConversation(conversationId).subscribe(() => (done = true));

    const req = httpMock.expectOne(`${baseUrl}/${conversationId}`);
    expect(req.request.method).toBe('DELETE');

    req.flush(null);
    expect(done).toBe(true);
  });

  it('archiveConversation() should PATCH /:conversationId/archive with {}', () => {
    const conversationId = 'cid_arc';

    let result: Conversation | undefined;
    service.archiveConversation(conversationId).subscribe((res) => (result = res));

    const req = httpMock.expectOne(`${baseUrl}/${conversationId}/archive`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({});

    const mock: Conversation = {
      id: conversationId,
      userId: 'u9',
      archived: true,
    };
    req.flush(mock);

    expect(result).toEqual(mock);
  });

  it('unarchiveConversation() should PATCH /:conversationId/unarchive with {}', () => {
    const conversationId = 'cid_unarc';

    let result: Conversation | undefined;
    service.unarchiveConversation(conversationId).subscribe((res) => (result = res));

    const req = httpMock.expectOne(`${baseUrl}/${conversationId}/unarchive`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({});

    const mock: Conversation = {
      id: conversationId,
      userId: 'u9',
      archived: false,
    };
    req.flush(mock);

    expect(result).toEqual(mock);
  });
});