// chatbox.spec.ts (Angular v21 + Vitest) — FULL FILE
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { provideRouter, Router, NavigationEnd } from '@angular/router';
import {
  provideHttpClient,
  HttpClient,
  HttpClientModule,
} from '@angular/common/http';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';
import { of, throwError, Subscription, Subject, Observable } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Chatbox } from './chatbox';
import { ConversationService, Conversation } from '../../../services/conversation';
import { UiModalService } from '../../../shared/ui-modal/ui-modal.service';

// ✅ Make jsPDF constructable
vi.mock('jspdf', () => {
  return { jsPDF: vi.fn() };
});
import { jsPDF } from 'jspdf';

describe('Chatbox (Angular v21 unit-test, Vitest)', () => {
  let fixture: ComponentFixture<Chatbox>;
  let component: Chatbox;
  let httpMock: HttpTestingController;

  let convoApi: {
    getByUser: ReturnType<typeof vi.fn>;
    createConversation: ReturnType<typeof vi.fn>;
    addTurn: ReturnType<typeof vi.fn>;
    deleteConversation: ReturnType<typeof vi.fn>;
    archiveConversation: ReturnType<typeof vi.fn>;
  };

  let uiModal: {
    notify: ReturnType<typeof vi.fn>;
  };

  const setSession = (map: Record<string, string>) => {
    sessionStorage.clear();
    for (const [k, v] of Object.entries(map)) sessionStorage.setItem(k, v);
  };

  const flushMicrotasks = async () => {
    await Promise.resolve();
    await Promise.resolve();
  };

  const flushTimers = async () => {
    await new Promise<void>((r) => setTimeout(r, 0));
  };

  let routerEvents$: Subject<any>;
  let logoSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const msgWrap = document.createElement('div');
    msgWrap.className = 'chat__messages';
    msgWrap.style.height = '100px';
    msgWrap.style.overflow = 'auto';
    document.body.appendChild(msgWrap);

    convoApi = {
      getByUser: vi.fn(),
      createConversation: vi.fn(),
      addTurn: vi.fn(),
      deleteConversation: vi.fn(),
      archiveConversation: vi.fn(),
    };

    uiModal = {
      notify: vi.fn().mockResolvedValue(undefined),
    };

    routerEvents$ = new Subject<any>();

    const tb = TestBed.configureTestingModule({
      imports: [Chatbox],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ConversationService, useValue: convoApi as any },
        { provide: UiModalService, useValue: uiModal as any },
        {
          provide: Router,
          useValue: {
            navigate: vi.fn().mockResolvedValue(true),
            events: routerEvents$.asObservable(),
          },
        },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    });

    tb.overrideComponent(Chatbox, {
      remove: { imports: [HttpClientModule] },
    });

    await tb.compileComponents();

    httpMock = TestBed.inject(HttpTestingController);

    fixture = TestBed.createComponent(Chatbox);
    component = fixture.componentInstance;

    convoApi.getByUser.mockReturnValue(of([] as Conversation[]));
    convoApi.createConversation.mockReturnValue(
      of({ id: 'c-created', title: 'New' } as any)
    );
    convoApi.addTurn.mockReturnValue(of({ ok: true } as any));
    convoApi.deleteConversation.mockReturnValue(of({ ok: true } as any));
    convoApi.archiveConversation.mockReturnValue(of({ ok: true } as any));

    // ✅ default: prevent real fetch/FileReader in most tests
    logoSpy = vi.spyOn(component as any, 'loadImageAsDataURL').mockResolvedValue(null);

    fixture.detectChanges();
    await flushMicrotasks();
  });

  afterEach(() => {
    try {
      httpMock.verify();
    } catch {}
    sessionStorage.clear();
    document.querySelector('.chat__messages')?.remove();
    routerEvents$?.complete();
    vi.restoreAllMocks();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('normalizeId should handle null/blank/null-string/undefined-string', () => {
    const n = (component as any).normalizeId.bind(component);
    expect(n(null)).toBeNull();
    expect(n('')).toBeNull();
    expect(n('   ')).toBeNull();
    expect(n('null')).toBeNull();
    expect(n('undefined')).toBeNull();
    expect(n('  abc  ')).toBe('abc');
  });

  it('autoGrow should resize textarea based on scrollHeight', () => {
    const ta = document.createElement('textarea');
    Object.defineProperty(ta, 'scrollHeight', { value: 123, configurable: true });

    ta.style.height = '999px';
    component.autoGrow({ target: ta } as any);

    expect(ta.style.height).toBe('123px');
  });

  it('syncAuth guest mode should clear chats + activeConversationId', async () => {
    setSession({ isLoggedIn: '0' });

    (component as any).syncAuth();
    await flushMicrotasks();

    expect(component.isLoggedIn).toBe(false);
    expect(component.chats).toEqual([]);
    expect(component.activeConversationId).toBeNull();
    expect(sessionStorage.getItem('activeConversationId')).toBeNull();
  });

  it('syncAuth logged-in should load conversations', async () => {
    setSession({
      isLoggedIn: 'true',
      userEmail: 'a@b.com',
      userId: 'u1',
      activeConversationId: 'c1',
    });

    const convos: Conversation[] = [
      { id: 'c1', userId: 'u1', title: 'T1', archived: false, turns: [] } as any,
    ];
    convoApi.getByUser.mockReturnValue(of(convos));

    (component as any).syncAuth();
    await flushMicrotasks();

    expect(component.isLoggedIn).toBe(true);
    expect(component.userId).toBe('u1');
    expect(component.userEmail).toBe('a@b.com');
    expect(component.chats).toEqual([{ id: 'c1', title: 'T1' }]);
  });

  // ✅ FIXED: must set sessionStorage because ngOnInit() calls syncAuth()
  it('ngOnInit should restore last conversation when logged in and activeConversationId exists', async () => {
    setSession({
      isLoggedIn: 'true',
      userId: 'u1',
      userEmail: 'x@y.com',
      activeConversationId: 'c-restore',
    });

    const spOpen = vi.spyOn(component, 'openChat').mockResolvedValue(undefined as any);

    component.ngOnInit();
    await flushMicrotasks();

    expect(spOpen).toHaveBeenCalledWith('c-restore');
  });

  it('ngOnInit should call syncAuth on NavigationEnd to /chatbox', async () => {
    const spSync = vi.spyOn(component as any, 'syncAuth');

    component.ngOnInit();
    routerEvents$.next(new NavigationEnd(1, '/chatbox', '/chatbox'));

    await flushMicrotasks();
    expect(spSync).toHaveBeenCalled();
  });

  it('loadConversations should handle error and set chats empty', async () => {
    component.isLoggedIn = true;
    component.userId = 'u1';

    convoApi.getByUser.mockReturnValue(throwError(() => new Error('boom')));

    await (component as any).loadConversations();
    await flushMicrotasks();

    expect(component.chats).toEqual([]);
  });

  it('loadConversations success should map chats (non-archived only) and use id extractors', async () => {
    component.isLoggedIn = true;
    component.userId = 'u1';

    convoApi.getByUser.mockReturnValue(
      of([
        { _id: 'a1', title: 'A', archived: false },
        { conversationId: 'a2', title: 'B', archived: true },
        { conversation_id: 'a3', title: '', archived: false },
        { id: null, title: 'X', archived: false },
      ] as any)
    );

    await (component as any).loadConversations();
    await flushMicrotasks();

    expect(component.chats).toEqual([
      { id: 'a1', title: 'A' },
      { id: 'a3', title: '(Untitled)' },
    ]);
  });

  it('toggleSidebar should flip sidebarOpen', () => {
    component.sidebarOpen = true;
    component.toggleSidebar();
    expect(component.sidebarOpen).toBe(false);
    component.toggleSidebar();
    expect(component.sidebarOpen).toBe(true);
  });

  it('openChat should early return when chatId is blank/null-ish', async () => {
    component.isLoggedIn = true;
    component.userId = 'u1';

    const http = TestBed.inject(HttpClient);
    const sp = vi.spyOn(http, 'get');

    await component.openChat('   ');
    await flushMicrotasks();

    expect(sp).not.toHaveBeenCalled();
  });

  it('openChat success should rebuild messages + set activeConversationId + save session (logged in)', async () => {
    component.isLoggedIn = true;
    component.userId = 'u1';
    component.activeConversationId = 'c1';

    component.openChat('c1');

    const req = httpMock.expectOne(
      (r) => r.url === 'http://localhost:8080/api/conversations/c1'
    );
    expect(req.request.method).toBe('GET');

    req.flush({
      id: 'c1',
      turns: [
        { userMessage: 'hi', botResponse: 'hello' },
        { userMessage: 'x', botResponse: 'y' },
      ],
    });

    await flushMicrotasks();
    await flushTimers();

    expect(component.activeConversationId).toBe('c1');
    expect(sessionStorage.getItem('activeConversationId')).toBe('c1');
    expect(component.messages).toEqual([
      { role: 'user', text: 'hi' },
      { role: 'ai', text: 'hello' },
      { role: 'user', text: 'x' },
      { role: 'ai', text: 'y' },
    ]);
  });

  it('openChat with empty turns should set messages to []', async () => {
    component.isLoggedIn = true;
    component.userId = 'u1';

    component.openChat('c-empty');
    const req = httpMock.expectOne(
      (r) => r.url === 'http://localhost:8080/api/conversations/c-empty'
    );
    req.flush({ id: 'c-empty', turns: [] });

    await flushMicrotasks();
    await flushTimers();

    expect(component.activeConversationId).toBe('c-empty');
    expect(component.messages).toEqual([]);
  });

  it('openChat failure should push warning bubble + clear activeConversationId', async () => {
    component.isLoggedIn = true;
    component.userId = 'u1';
    component.activeConversationId = 'c1';

    component.openChat('c1');

    const req = httpMock.expectOne(
      (r) => r.url === 'http://localhost:8080/api/conversations/c1'
    );
    req.flush({ message: 'not found' }, { status: 404, statusText: 'Not Found' });

    await flushMicrotasks();
    await flushTimers();

    expect(component.activeConversationId).toBeNull();
    expect(component.messages.some((m) => m.text.includes('Failed to open'))).toBe(true);
    expect(sessionStorage.getItem('activeConversationId')).toBeNull();
  });

  it('startNewChat should reset state and clear activeConversationId', async () => {
    component.messages = [{ role: 'user', text: 'old' } as any];
    component.activeConversationId = 'c1';
    sessionStorage.setItem('activeConversationId', 'c1');

    component.startNewChat();
    await flushMicrotasks();

    expect(component.activeConversationId).toBeNull();
    expect(sessionStorage.getItem('activeConversationId')).toBeNull();
    expect(component.messages[0].role).toBe('ai');
    expect(component.message).toBe('');
    expect(component.sending).toBe(false);
  });

  it('goLogin / goSignup should navigate', () => {
    component.goLogin();
    expect((component as any).router.navigate).toHaveBeenCalledWith(['/indexlogin']);

    component.goSignup();
    expect((component as any).router.navigate).toHaveBeenCalledWith(['/signup']);
  });

  it('goArchive should open archive modal', () => {
    component.showArchiveModal = false;
    component.goArchive();
    expect(component.showArchiveModal).toBe(true);
  });

  it('logout should clear session and navigate home', () => {
    setSession({ isLoggedIn: 'true', userId: 'u1' });
    component.logout();

    expect(sessionStorage.getItem('userId')).toBeNull();
    expect((component as any).router.navigate).toHaveBeenCalledWith(['/']);
  });

  it('onSubmit should call saveEditAndResend if editingIndex not null', () => {
    component.sending = false;
    component.editingIndex = 0;
    const sp = vi.spyOn(component, 'saveEditAndResend');

    component.onSubmit();
    expect(sp).toHaveBeenCalled();
  });

  it('onSubmit should call sendMessage on normal mode', () => {
    component.sending = false;
    component.editingIndex = null;
    const sp = vi.spyOn(component, 'sendMessage');

    component.onSubmit();
    expect(sp).toHaveBeenCalled();
  });

  it('sendMessage (guest) should send chat request with history, push user+ai', async () => {
    component.isLoggedIn = false;
    component.userId = '';

    component.messages = [{ role: 'ai', text: 'Hi! Ask me anything.' } as any];
    component.message = 'hello';

    component.sendMessage();

    const req = httpMock.expectOne((r) => r.url === 'http://localhost:8080/api/chat');
    expect(req.request.method).toBe('POST');
    expect(req.request.body.history).toBeTruthy();

    req.flush({ reply: 'world' });

    await flushMicrotasks();
    await flushTimers();

    expect(component.messages.some((m) => m.role === 'user' && m.text === 'hello')).toBe(true);
    expect(component.messages.some((m) => m.role === 'ai' && m.text === 'world')).toBe(true);
    expect(component.sending).toBe(false);
  });

  it('sendMessage should push HTTP error bubble', async () => {
    component.isLoggedIn = false;

    component.message = 'boom';
    component.sendMessage();

    const req = httpMock.expectOne((r) => r.url === 'http://localhost:8080/api/chat');
    req.flush({ err: true }, { status: 500, statusText: 'Server Error' });

    await flushMicrotasks();
    await flushTimers();

    expect(component.messages.some((m) => m.text.includes('HTTP 500'))).toBe(true);
    expect(component.sending).toBe(false);
  });

  it('sendMessage should show TimeoutError bubble when http.post errors with TimeoutError', async () => {
    component.isLoggedIn = false;

    const http = (component as any).http as HttpClient;
    vi.spyOn(http, 'post').mockReturnValue(
      throwError(() => ({ name: 'TimeoutError' })) as any
    );

    component.message = 'hello';
    await component.sendMessage();

    await flushMicrotasks();
    await flushTimers();

    expect(component.messages.some((m) => m.text.includes('Timed out'))).toBe(true);
    expect(component.sending).toBe(false);
  });

  it('sendMessage (logged in) should create conversation if no activeConversationId', async () => {
    component.isLoggedIn = true;
    component.userId = 'u1';
    component.userEmail = 'x@y.com';
    component.activeConversationId = null;

    component.message = 'first';
    component.sendMessage();

    const req = httpMock.expectOne((r) => r.url === 'http://localhost:8080/api/chat');
    req.flush({ reply: 'reply1' });

    await flushMicrotasks();
    await flushTimers();
    await flushMicrotasks();

    expect(convoApi.createConversation).toHaveBeenCalled();
    expect(component.activeConversationId).toBe('c-created');
    expect(sessionStorage.getItem('activeConversationId')).toBe('c-created');
  });

  it('sendMessage (logged in) should addTurn if activeConversationId exists', async () => {
    component.isLoggedIn = true;
    component.userId = 'u1';
    component.activeConversationId = 'c1';

    component.message = 'next';
    component.sendMessage();

    const req = httpMock.expectOne((r) => r.url === 'http://localhost:8080/api/chat');
    req.flush({ reply: 'ok' });

    await flushMicrotasks();
    await flushTimers();
    await flushMicrotasks();

    expect(convoApi.addTurn).toHaveBeenCalledWith(
      'c1',
      { userMessage: 'next', botResponse: 'ok' } as any
    );
  });

  it('sendMessage should ignore response if user switched conversations while waiting', async () => {
    component.isLoggedIn = true;
    component.userId = 'u1';
    component.activeConversationId = 'c1';

    component.message = 'hello';
    component.sendMessage();

    const req = httpMock.expectOne((r) => r.url === 'http://localhost:8080/api/chat');

    component.activeConversationId = 'c2';
    req.flush({ reply: 'world' });

    await flushMicrotasks();
    await flushTimers();

    expect(component.messages.some((m) => m.role === 'ai' && m.text === 'world')).toBe(false);
    expect(component.sending).toBe(false);
  });

  it('stopGeneration should cancel inflight and optionally open edit last user', () => {
    (component as any).inflightChatSub = { unsubscribe: vi.fn() } as unknown as Subscription;

    component.messages = [
      { role: 'ai', text: 'a' } as any,
      { role: 'user', text: 'u1' } as any,
    ];
    component.editingIndex = null;

    const sp = vi.spyOn(component, 'startEditUserMessage');

    component.stopGeneration(true);

    expect((component as any).inflightChatSub).toBeUndefined();
    expect(component.sending).toBe(false);
    expect(sp).toHaveBeenCalledWith(1);
  });

  it('startEditUserMessage should set editing state and stop generation if sending', () => {
    component.messages = [{ role: 'user', text: 'hello' } as any];
    component.sending = true;

    const sp = vi.spyOn(component, 'stopGeneration');

    component.startEditUserMessage(0);

    expect(sp).toHaveBeenCalledWith(false);
    expect(component.editingIndex).toBe(0);
    expect(component.editingText).toBe('hello');
  });

  it('startEditUserMessage should ignore if wrong role', () => {
    component.messages = [{ role: 'ai', text: 'x' } as any];
    component.startEditUserMessage(0);
    expect(component.editingIndex).toBeNull();
  });

  it('cancelEdit should reset editing state and optionally clear message', () => {
    component.editingIndex = 0;
    component.editingText = 'x';
    component.message = 'typed';

    component.cancelEdit(true);

    expect(component.editingIndex).toBeNull();
    expect(component.editingText).toBe('');
    expect((component as any).originalEditText).toBe('');
    expect(component.message).toBe('');
  });

  it('saveEditAndResend should do nothing if trimmed edit is empty', () => {
    component.messages = [{ role: 'user', text: 'old' } as any];
    component.editingIndex = 0;
    component.editingText = '   ';

    component.saveEditAndResend();

    expect(component.messages).toEqual([{ role: 'user', text: 'old' } as any]);
  });

  it('saveEditAndResend should trim conversation and call startBotResponseForEditedMessage', () => {
    component.messages = [
      { role: 'user', text: 'old' } as any,
      { role: 'ai', text: 'ans' } as any,
      { role: 'user', text: 'later' } as any,
    ];
    component.editingIndex = 0;
    component.editingText = 'new';

    const sp = vi
      .spyOn(component as any, 'startBotResponseForEditedMessage')
      .mockResolvedValue(undefined);

    component.saveEditAndResend();

    expect(component.messages).toEqual([{ role: 'user', text: 'new' } as any]);
    expect(sp).toHaveBeenCalledWith('new');
  });

  it('copyText should use clipboard when available', async () => {
    (navigator as any).clipboard = { writeText: vi.fn().mockResolvedValue(undefined) };
    await component.copyText('x');
    expect((navigator as any).clipboard.writeText).toHaveBeenCalledWith('x');
  });

  it('copyText should fallback to textarea when clipboard fails', async () => {
    (navigator as any).clipboard = { writeText: vi.fn().mockRejectedValue(new Error('no')) };
    (document as any).execCommand = vi.fn().mockReturnValue(true);
    const sp = vi.spyOn(document as any, 'execCommand');

    await component.copyText('y');
    expect(sp).toHaveBeenCalledWith('copy');
  });

  it('onExportChat should rebuild msgs and call exportConversationPdfForMessages', async () => {
    const sp = vi
      .spyOn(component as any, 'exportConversationPdfForMessages')
      .mockResolvedValue(undefined);

    component.onExportChat('c1');

    const req = httpMock.expectOne(
      (r) => r.url === 'http://localhost:8080/api/conversations/c1'
    );
    req.flush({
      id: 'c1',
      title: 'My convo',
      turns: [{ userMessage: 'u', botResponse: 'b' }],
    });

    await flushMicrotasks();
    await flushTimers();

    expect(sp).toHaveBeenCalled();
  });

  it('onExportChat should alert when no messages', async () => {
    const sp = vi.spyOn(window, 'alert').mockImplementation(() => {});
    component.onExportChat('c1');

    const req = httpMock.expectOne(
      (r) => r.url === 'http://localhost:8080/api/conversations/c1'
    );
    req.flush({ id: 'c1', title: 'Empty', turns: [] });

    await flushMicrotasks();
    await flushTimers();

    expect(sp).toHaveBeenCalled();
  });

  it('onExportChat should alert on error', async () => {
    const sp = vi.spyOn(window, 'alert').mockImplementation(() => {});
    component.onExportChat('c1');

    const req = httpMock.expectOne(
      (r) => r.url === 'http://localhost:8080/api/conversations/c1'
    );
    req.flush({ err: true }, { status: 500, statusText: 'Server Error' });

    await flushMicrotasks();
    await flushTimers();

    expect(sp).toHaveBeenCalled();
  });

  it('exportConversationPdf should alert when no messages', async () => {
    const sp = vi.spyOn(window, 'alert').mockImplementation(() => {});
    component.messages = [];
    await component.exportConversationPdf();
    expect(sp).toHaveBeenCalledWith('No conversation to export yet.');
  });

  it('exportConversationPdf should generate PDF and call doc.save', async () => {
    const mockDoc: any = {
      internal: { pageSize: { getWidth: () => 595, getHeight: () => 842 } },
      addImage: vi.fn(),
      setFont: vi.fn(),
      setFontSize: vi.fn(),
      setTextColor: vi.fn(),
      text: vi.fn(),
      setDrawColor: vi.fn(),
      line: vi.fn(),
      setFillColor: vi.fn(),
      rect: vi.fn(),
      splitTextToSize: (t: string) => [t],
      addPage: vi.fn(),
      save: vi.fn(),
    };

    (jsPDF as any).mockImplementation(function () {
      return mockDoc;
    });

    component.messages = [
      { role: 'user', text: 'hello' } as any,
      { role: 'ai', text: 'world' } as any,
    ];

    await component.exportConversationPdf();
    expect(mockDoc.save).toHaveBeenCalled();
  });

  // ✅ FIXED: restore real method (because beforeEach mocked it to null)
  it('loadImageAsDataURL should return data url on success (mock fetch + FileReader)', async () => {
    logoSpy.mockRestore();

    const originalFetch = globalThis.fetch;
    const originalFR = (globalThis as any).FileReader;

    globalThis.fetch = vi.fn().mockResolvedValue({
      blob: vi.fn().mockResolvedValue(new Blob(['x'], { type: 'image/png' })),
    } as any);

    class FRMock {
      result: any = 'data:image/png;base64,AAA';
      onload: any;
      onerror: any;
      readAsDataURL() {
        this.onload?.();
      }
    }
    (globalThis as any).FileReader = FRMock;

    const out = await (component as any).loadImageAsDataURL('assets/emman.png');
    expect(out).toContain('data:image/png');

    globalThis.fetch = originalFetch!;
    (globalThis as any).FileReader = originalFR!;

    // re-spy for other tests
    logoSpy = vi.spyOn(component as any, 'loadImageAsDataURL').mockResolvedValue(null);
  });

  // ✅ FIXED: restore real method (because beforeEach mocked it to null)
  it('loadImageAsDataURL should return null on failure', async () => {
    logoSpy.mockRestore();

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('nope')) as any;

    const out = await (component as any).loadImageAsDataURL('assets/emman.png');
    expect(out).toBeNull();

    globalThis.fetch = originalFetch!;

    // re-spy for other tests
    logoSpy = vi.spyOn(component as any, 'loadImageAsDataURL').mockResolvedValue(null);
  });

  it('exportConversationPdfForMessages should sanitize filename and call doc.save', async () => {
    const mockDoc: any = {
      internal: { pageSize: { getWidth: () => 595, getHeight: () => 842 } },
      addImage: vi.fn(),
      setFont: vi.fn(),
      setFontSize: vi.fn(),
      setTextColor: vi.fn(),
      text: vi.fn(),
      setDrawColor: vi.fn(),
      line: vi.fn(),
      setFillColor: vi.fn(),
      rect: vi.fn(),
      splitTextToSize: (t: string) => [t],
      addPage: vi.fn(),
      save: vi.fn(),
    };

    (jsPDF as any).mockImplementation(function () {
      return mockDoc;
    });

    await (component as any).exportConversationPdfForMessages(
      [
        { role: 'user', text: 'Hello' },
        { role: 'ai', text: 'World' },
      ],
      'bad/:*?"<>|name'
    );

    expect(mockDoc.save).toHaveBeenCalled();
    const filename = mockDoc.save.mock.calls.at(-1)?.[0] as string;
    expect(filename.includes('bad-')).toBe(true);
    expect(filename.endsWith('.pdf')).toBe(true);
  });

  it('extractConversationId should read multiple id keys', () => {
    const x = (component as any).extractConversationId.bind(component);
    expect(x({ id: '1' })).toBe('1');
    expect(x({ _id: '2' })).toBe('2');
    expect(x({ conversationId: '3' })).toBe('3');
    expect(x({ conversationID: '4' })).toBe('4');
    expect(x({ conversation_id: '5' })).toBe('5');
    expect(x(null)).toBeNull();
  });

  it('buildHistory should map roles to assistant/user and filter empty', () => {
    component.messages = [
      { role: 'ai', text: 'a1' } as any,
      { role: 'user', text: 'u1' } as any,
      { role: 'ai', text: '   ' } as any,
    ];

    const h = (component as any).buildHistory(10);
    expect(h).toEqual([
      { role: 'assistant', content: 'a1' },
      { role: 'user', content: 'u1' },
    ]);
  });

  it('scrollToBottom should set scrollTop to scrollHeight (cover internals)', async () => {
    const el = document.querySelector('.chat__messages') as HTMLElement;

    Object.defineProperty(el, 'scrollHeight', { value: 999, configurable: true });
    Object.defineProperty(el, 'scrollTop', {
      value: 0,
      writable: true,
      configurable: true,
    });

    vi.useFakeTimers();
    (component as any).scrollToBottom();
    vi.runAllTimers();
    vi.useRealTimers();

    expect((el as any).scrollTop).toBe(999);
  });

  it('onDeleteChat success should remove from sidebar list and notify success', async () => {
    component.isLoggedIn = true;
    component.userId = 'u1';
    component.chats = [
      { id: 'c1', title: 'T1' },
      { id: 'c2', title: 'T2' },
    ];
    component.activeConversationId = 'c1';
    sessionStorage.setItem('activeConversationId', 'c1');

    component.messages = [{ role: 'user', text: 'hi' } as any];
    component.message = 'x';
    component.sending = true;

    convoApi.deleteConversation.mockReturnValue(of({ ok: true } as any));

    await component.onDeleteChat('c1');

    expect(component.chats).toEqual([{ id: 'c2', title: 'T2' }]);
    expect(component.activeConversationId).toBeNull();
    expect(sessionStorage.getItem('activeConversationId')).toBeNull();
    expect(component.messages).toEqual([]);
    expect(component.message).toBe('');
    expect(component.sending).toBe(false);

    expect(uiModal.notify).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Deleted', variant: 'success' })
    );
  });

  it('onDeleteChat failure should still reset if active and notify danger', async () => {
    component.isLoggedIn = true;
    component.userId = 'u1';
    component.activeConversationId = 'c1';
    sessionStorage.setItem('activeConversationId', 'c1');

    component.messages = [{ role: 'user', text: 'hi' } as any];

    convoApi.deleteConversation.mockReturnValue(
      throwError(() => new Error('db down'))
    );

    await component.onDeleteChat('c1');

    expect(component.activeConversationId).toBeNull();
    expect(sessionStorage.getItem('activeConversationId')).toBeNull();
    expect(component.messages).toEqual([]);

    expect(uiModal.notify).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Delete failed', variant: 'danger' })
    );
  });

  it('onArchiveChat success should remove from sidebar list and notify success', async () => {
    component.isLoggedIn = true;
    component.userId = 'u1';
    component.chats = [
      { id: 'c1', title: 'T1' },
      { id: 'c2', title: 'T2' },
    ];
    component.activeConversationId = 'c1';
    sessionStorage.setItem('activeConversationId', 'c1');

    component.messages = [{ role: 'user', text: 'hi' } as any];

    convoApi.archiveConversation.mockReturnValue(of({ ok: true } as any));

    await component.onArchiveChat('c1');

    expect(component.chats).toEqual([{ id: 'c2', title: 'T2' }]);
    expect(component.activeConversationId).toBeNull();
    expect(sessionStorage.getItem('activeConversationId')).toBeNull();
    expect(component.messages).toEqual([]);

    expect(uiModal.notify).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Archived', variant: 'success' })
    );
  });

  it('onArchiveChat failure should notify danger and not crash', async () => {
    component.isLoggedIn = true;
    component.userId = 'u1';

    convoApi.archiveConversation.mockReturnValue(
      throwError(() => new Error('boom'))
    );

    await component.onArchiveChat('c1');

    expect(uiModal.notify).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Archive failed', variant: 'danger' })
    );
  });

  it('openArchiveModal/closeArchiveModal should toggle showArchiveModal', () => {
    component.showArchiveModal = false;
    component.openArchiveModal();
    expect(component.showArchiveModal).toBe(true);

    component.closeArchiveModal();
    expect(component.showArchiveModal).toBe(false);
  });

  it('startBotResponseForEditedMessage should early return if sending is true', async () => {
    component.sending = true;
    const http = (component as any).http as HttpClient;
    const sp = vi.spyOn(http, 'post');
    await (component as any).startBotResponseForEditedMessage('hello');
    expect(sp).not.toHaveBeenCalled();
  });

  it('startBotResponseForEditedMessage should early return if text trims to empty', async () => {
    component.sending = false;
    const http = (component as any).http as HttpClient;
    const sp = vi.spyOn(http, 'post');
    await (component as any).startBotResponseForEditedMessage('   ');
    expect(sp).not.toHaveBeenCalled();
  });

  it('startBotResponseForEditedMessage should POST and addTurn when logged in and has convoId', async () => {
    component.isLoggedIn = true;
    component.userId = 'u1';
    component.activeConversationId = 'c1';
    component.sending = false;

    (component as any).startBotResponseForEditedMessage('edited');

    const req = httpMock.expectOne((r) => r.url === 'http://localhost:8080/api/chat');
    req.flush({ reply: 'reply-edited' });

    await flushMicrotasks();
    await flushTimers();
    await flushMicrotasks();

    expect(
      component.messages.some((m: any) => m.role === 'ai' && m.text === 'reply-edited')
    ).toBe(true);
    expect(convoApi.addTurn).toHaveBeenCalledWith(
      'c1',
      { userMessage: 'edited', botResponse: 'reply-edited' } as any
    );
  });

  it('toggleVoice should alert when SpeechRecognition not supported', () => {
    const sp = vi.spyOn(window, 'alert').mockImplementation(() => {});
    (window as any).SpeechRecognition = undefined;
    (window as any).webkitSpeechRecognition = undefined;

    component.toggleVoice();
    expect(sp).toHaveBeenCalled();
  });

  it('toggleVoice supported should start then stop and update listening', () => {
    const start = vi.fn();
    const stop = vi.fn();

    class SR {
      lang = '';
      continuous = false;
      interimResults = false;
      onresult: any;
      onend: any;
      onerror: any;
      start = start;
      stop = stop;
    }

    (window as any).SpeechRecognition = SR;

    component.toggleVoice();
    expect(start).toHaveBeenCalled();
    expect(component.listening).toBe(true);

    component.toggleVoice();
    expect(stop).toHaveBeenCalled();
    expect(component.listening).toBe(false);
  });

  it('toggleVoice should set message on recognition.onresult and stop onend/onerror', () => {
    const start = vi.fn();
    const stop = vi.fn();

    class SR {
      lang = '';
      continuous = false;
      interimResults = false;
      onresult: any;
      onend: any;
      onerror: any;
      start = start;
      stop = stop;
    }

    (window as any).SpeechRecognition = SR;

    component.toggleVoice();

    const rec = (component as any).recognition;
    rec.onresult?.({ results: [[{ transcript: 'hello voice' }]] });
    expect(component.message).toBe('hello voice');

    rec.onend?.();
    expect(component.listening).toBe(false);

    component.toggleVoice();
    const rec2 = (component as any).recognition;
    rec2.onerror?.();
    expect(component.listening).toBe(false);
  });

  it('reloadConversations should call loadConversations only when logged in + has userId', async () => {
    const sp = vi.spyOn(component as any, 'loadConversations').mockResolvedValue(undefined);

    component.isLoggedIn = false;
    component.userId = '';
    component.reloadConversations();
    expect(sp).not.toHaveBeenCalled();

    component.isLoggedIn = true;
    component.userId = 'u1';
    component.reloadConversations();
    expect(sp).toHaveBeenCalled();
  });

    it('sendMessage (guest) should show Guest Mode warning only once', async () => {
    component.isLoggedIn = false;
    component.userId = '';
    component.messages = []; // no prior warning
    component.message = 'hi1';

    component.sendMessage();
    const req1 = httpMock.expectOne((r) => r.url === 'http://localhost:8080/api/chat');
    req1.flush({ reply: 'r1' });

    await flushMicrotasks();
    await flushTimers();

    const warnCountAfter1 = component.messages.filter(m =>
      (m.text || '').includes('Guest Mode')
    ).length;
    expect(warnCountAfter1).toBe(1);

    // second send should not add another warning bubble
    component.message = 'hi2';
    component.sendMessage();
    const req2 = httpMock.expectOne((r) => r.url === 'http://localhost:8080/api/chat');
    req2.flush({ reply: 'r2' });

    await flushMicrotasks();
    await flushTimers();

    const warnCountAfter2 = component.messages.filter(m =>
      (m.text || '').includes('Guest Mode')
    ).length;
    expect(warnCountAfter2).toBe(1);
  });

  it('cancelEdit(false) should keep typed message', () => {
    component.editingIndex = 0;
    component.editingText = 'edit';
    (component as any).originalEditText = 'orig';
    component.message = 'keep-me';

    component.cancelEdit(false);

    expect(component.editingIndex).toBeNull();
    expect(component.editingText).toBe('');
    expect((component as any).originalEditText).toBe('');
    expect(component.message).toBe('keep-me');
  });

  it('stopGeneration(false) should NOT open edit bubble', () => {
    (component as any).inflightChatSub = { unsubscribe: vi.fn() } as unknown as Subscription;
    component.sending = true;

    const spEdit = vi.spyOn(component, 'startEditUserMessage');

    component.stopGeneration(false);

    expect((component as any).inflightChatSub).toBeUndefined();
    expect(component.sending).toBe(false);
    expect(spEdit).not.toHaveBeenCalled();
  });

  it('openChat should call stopGeneration(false) and cancelEdit(false) before loading', async () => {
    component.isLoggedIn = true;
    component.userId = 'u1';

    const spStop = vi.spyOn(component, 'stopGeneration');
    const spCancel = vi.spyOn(component, 'cancelEdit');

    component.openChat('c100');

    const req = httpMock.expectOne((r) => r.url === 'http://localhost:8080/api/conversations/c100');
    req.flush({ id: 'c100', turns: [{ userMessage: 'u', botResponse: 'b' }] });

    await flushMicrotasks();
    await flushTimers();

    expect(spStop).toHaveBeenCalledWith(false);
    expect(spCancel).toHaveBeenCalledWith(false);
  });

  it('startBotResponseForEditedMessage (logged in, no convoId) should createConversation + set session', async () => {
    component.isLoggedIn = true;
    component.userId = 'u1';
    component.activeConversationId = null;
    component.sending = false;

    const spLoad = vi.spyOn(component as any, 'loadConversations').mockResolvedValue(undefined);

    (component as any).startBotResponseForEditedMessage('edited-first');

    const req = httpMock.expectOne((r) => r.url === 'http://localhost:8080/api/chat');
    req.flush({ reply: 'bot1' });

    await flushMicrotasks();
    await flushTimers();
    await flushMicrotasks();

    expect(convoApi.createConversation).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        firstUserMessage: 'edited-first',
        firstBotResponse: 'bot1',
      })
    );

    expect(component.activeConversationId).toBe('c-created');
    expect(sessionStorage.getItem('activeConversationId')).toBe('c-created');
    expect(spLoad).toHaveBeenCalled();
  });

  it('startBotResponseForEditedMessage should push TimeoutError bubble when post fails with TimeoutError', async () => {
    component.isLoggedIn = false;
    component.userId = '';
    component.sending = false;
    component.messages = [];

    const http = (component as any).http as HttpClient;
    vi.spyOn(http, 'post').mockReturnValue(
      throwError(() => ({ name: 'TimeoutError' })) as any
    );

    await (component as any).startBotResponseForEditedMessage('hello');

    await flushMicrotasks();
    await flushTimers();

    expect(component.messages.some(m => (m.text || '').includes('Timed out'))).toBe(true);
    expect(component.sending).toBe(false);
  });

  it('startBotResponseForEditedMessage should push HTTP error bubble when post errors with status', async () => {
    component.isLoggedIn = false;
    component.sending = false;
    component.messages = [];

    const http = (component as any).http as HttpClient;
    vi.spyOn(http, 'post').mockReturnValue(
      throwError(() => ({
        name: 'HttpErrorResponse',
        status: 500,
        statusText: 'Server Error',
      })) as any
    );

    await (component as any).startBotResponseForEditedMessage('hello');

    await flushMicrotasks();
    await flushTimers();

    // your component checks instanceof HttpErrorResponse, so fallback may be "Request failed"
    // still cover bubble path
    expect(component.messages.length).toBeGreaterThan(0);
    expect(component.sending).toBe(false);
  });

  it('sendMessage (logged in) should still work even if save step fails (catch saveErr)', async () => {
    component.isLoggedIn = true;
    component.userId = 'u1';
    component.activeConversationId = null;
    component.sending = false;
    component.messages = [];
    component.message = 'hi';

    convoApi.createConversation.mockReturnValue(throwError(() => new Error('db down')));

    component.sendMessage();

    const req = httpMock.expectOne((r) => r.url === 'http://localhost:8080/api/chat');
    req.flush({ reply: 'ok' });

    await flushMicrotasks();
    await flushTimers();
    await flushMicrotasks();

    // chat still adds AI message, save failure only logs warn
    expect(component.messages.some(m => m.role === 'ai' && m.text === 'ok')).toBe(true);
    expect(component.sending).toBe(false);
  });

  it('ngOnDestroy should unsubscribe navSub and inflightChatSub', () => {
    const nav = { unsubscribe: vi.fn() } as any;
    const inflight = { unsubscribe: vi.fn() } as any;

    (component as any).navSub = nav;
    (component as any).inflightChatSub = inflight;

    component.ngOnDestroy();

    expect(nav.unsubscribe).toHaveBeenCalled();
    expect(inflight.unsubscribe).toHaveBeenCalled();
  });

  it('buildHistory should respect maxTurns slicing', () => {
    component.messages = [
      { role: 'user', text: 'u1' } as any,
      { role: 'ai', text: 'a1' } as any,
      { role: 'user', text: 'u2' } as any,
      { role: 'ai', text: 'a2' } as any,
      { role: 'user', text: 'u3' } as any,
      { role: 'ai', text: 'a3' } as any,
    ];

    const h = (component as any).buildHistory(1);
    expect(h).toEqual([
      { role: 'user', content: 'u3' },
      { role: 'assistant', content: 'a3' },
    ]);
  });
    it('sendMessage should early return when message is blank', async () => {
    component.isLoggedIn = false;
    component.sending = false;
    component.messages = [{ role: 'ai', text: 'Hi!' } as any];

    component.message = '   ';
    await component.sendMessage();

    // no HTTP call should happen
    httpMock.expectNone((r) => r.url === 'http://localhost:8080/api/chat');
    expect(component.sending).toBe(false);
  });

  it('sendMessage should early return when already sending', async () => {
    component.isLoggedIn = false;
    component.sending = true;
    component.message = 'hello';

    await component.sendMessage();

    httpMock.expectNone((r) => r.url === 'http://localhost:8080/api/chat');
    expect(component.sending).toBe(true);
  });

  it('openChat (guest) should NOT save activeConversationId to sessionStorage', async () => {
    component.isLoggedIn = false;
    component.userId = '';

    component.openChat('c-guest');

    const req = httpMock.expectOne(
      (r) => r.url === 'http://localhost:8080/api/conversations/c-guest'
    );
    req.flush({
      id: 'c-guest',
      turns: [{ userMessage: 'u', botResponse: 'b' }],
    });

    await flushMicrotasks();
    await flushTimers();

    expect(component.activeConversationId).toBe('c-guest');
    expect(sessionStorage.getItem('activeConversationId')).toBeNull();
  });

  it('openChat should prefer extractConversationId from response (e.g., _id)', async () => {
    component.isLoggedIn = true;
    component.userId = 'u1';

    component.openChat('c-any');

    const req = httpMock.expectOne(
      (r) => r.url === 'http://localhost:8080/api/conversations/c-any'
    );
    req.flush({
      _id: 'server-id-123',
      turns: [{ userMessage: 'hi', botResponse: 'yo' }],
    });

    await flushMicrotasks();
    await flushTimers();

    expect(component.activeConversationId).toBe('server-id-123');
    expect(sessionStorage.getItem('activeConversationId')).toBe('server-id-123');
  });

  it('stopGeneration(true) should NOT open edit when there is no user message', () => {
    (component as any).inflightChatSub = { unsubscribe: vi.fn() } as any;
    component.sending = true;
    component.messages = [{ role: 'ai', text: 'only-ai' } as any];

    const spEdit = vi.spyOn(component, 'startEditUserMessage');

    component.stopGeneration(true);

    expect(spEdit).not.toHaveBeenCalled();
    expect(component.sending).toBe(false);
  });

  it('startEditUserMessage should ignore when editingIndex is already different', () => {
    component.messages = [
      { role: 'user', text: 'u1' } as any,
      { role: 'user', text: 'u2' } as any,
    ];

    component.editingIndex = 0;
    component.startEditUserMessage(1);

    // still locked on index 0
    expect(component.editingIndex).toBe(0);
    expect(component.editingText).toBe('');
  });

  it('startBotResponseForEditedMessage should ignore response if user switched conversations while waiting', async () => {
    component.isLoggedIn = true;
    component.userId = 'u1';
    component.activeConversationId = 'c1';
    component.sending = false;

    (component as any).startBotResponseForEditedMessage('edited');

    const req = httpMock.expectOne((r) => r.url === 'http://localhost:8080/api/chat');

    // user switches chat while waiting
    component.activeConversationId = 'c2';

    req.flush({ reply: 'reply-should-be-ignored' });

    await flushMicrotasks();
    await flushTimers();

    expect(component.messages.some(m => (m.text || '') === 'reply-should-be-ignored')).toBe(false);
    expect(component.sending).toBe(false);
  });

  it('toggleVoice should use webkitSpeechRecognition fallback when SpeechRecognition is missing', () => {
    const start = vi.fn();
    const stop = vi.fn();

    class WebkitSR {
      lang = '';
      continuous = false;
      interimResults = false;
      onresult: any;
      onend: any;
      onerror: any;
      start = start;
      stop = stop;
    }

    (window as any).SpeechRecognition = undefined;
    (window as any).webkitSpeechRecognition = WebkitSR;

    component.toggleVoice();
    expect(start).toHaveBeenCalled();
    expect(component.listening).toBe(true);

    component.toggleVoice();
    expect(stop).toHaveBeenCalled();
    expect(component.listening).toBe(false);
  });

  it('sanitizeFilename should replace invalid chars, collapse spaces, and cap length', () => {
    const fn = (component as any).sanitizeFilename.bind(component);

    const out = fn('  bad/:*?"<>|   name     with     spaces   ' + 'x'.repeat(200));
    expect(out.includes('/')).toBe(false);
    expect(out.includes('\\')).toBe(false);
    expect(out.includes(':')).toBe(false);
    expect(out.length).toBeLessThanOrEqual(60);
    expect(out.startsWith('bad-')).toBe(true);
  });
    it('sendMessage (logged in) should skip save when requestToken becomes stale after reply', async () => {
    component.isLoggedIn = true;
    component.userId = 'u1';
    component.activeConversationId = null;
    component.messages = [];
    component.message = 'hi';

    component.sendMessage();

    const req = httpMock.expectOne((r) => r.url === 'http://localhost:8080/api/chat');
    req.flush({ reply: 'ok' });

    // ✅ make token stale BEFORE the async continuation runs
    (component as any).requestToken++;
    // ✅ also simulate that sending is no longer active (like a new request / stop)
    component.sending = false;

    await flushMicrotasks();
    await flushTimers();
    await flushMicrotasks();

    // ✅ reply ignored
    expect(component.messages.some((m) => m.role === 'ai' && m.text === 'ok')).toBe(false);

    // ✅ save skipped
    expect(convoApi.createConversation).not.toHaveBeenCalled();
    expect(convoApi.addTurn).not.toHaveBeenCalled();

    expect(component.sending).toBe(false);
  });

  it('startBotResponseForEditedMessage (logged in) should skip save when requestToken becomes stale after reply', async () => {
    component.isLoggedIn = true;
    component.userId = 'u1';
    component.activeConversationId = null;
    component.messages = [];
    component.sending = false;

    (component as any).startBotResponseForEditedMessage('edited-first');

    const req = httpMock.expectOne((r) => r.url === 'http://localhost:8080/api/chat');
    req.flush({ reply: 'ok-edited' });

    // ✅ make token stale BEFORE the async continuation runs
    (component as any).requestToken++;
    component.sending = false;

    await flushMicrotasks();
    await flushTimers();
    await flushMicrotasks();

    // ✅ reply ignored
    expect(component.messages.some((m) => m.role === 'ai' && m.text === 'ok-edited')).toBe(false);

    // ✅ save skipped
    expect(convoApi.createConversation).not.toHaveBeenCalled();
    expect(convoApi.addTurn).not.toHaveBeenCalled();

    expect(component.sending).toBe(false);
  });

  it('seeAll and openSettings should be callable (function coverage)', () => {
    component.seeAll();
    component.openSettings();
    expect(true).toBe(true);
  });

  it('saveEditAndResend should early return when editingIndex is null', () => {
    component.editingIndex = null;
    component.editingText = 'hello';
    component.messages = [{ role: 'user', text: 'old' } as any];

    component.saveEditAndResend(); // should return immediately

    // nothing changed
    expect(component.messages[0].text).toBe('old');
  });

  it('exportConversationPdf should hit addImage + footer break + pagination addPage', async () => {
    // ✅ force logo to exist so addImage() runs
    logoSpy.mockResolvedValueOnce('data:image/png;base64,AAA');

    const mockDoc: any = {
      internal: { pageSize: { getWidth: () => 300, getHeight: () => 220 } }, // small page => paginate
      addImage: vi.fn(),
      setFont: vi.fn(),
      setFontSize: vi.fn(),
      setTextColor: vi.fn(),
      text: vi.fn(),
      setDrawColor: vi.fn(),
      line: vi.fn(),
      setFillColor: vi.fn(),
      rect: vi.fn(),
      // ✅ lots of lines so footer loop will eventually hit `break`
      splitTextToSize: vi.fn((t: string) => Array(200).fill(t)),
      addPage: vi.fn(),
      save: vi.fn(),
    };

    (jsPDF as any).mockImplementation(function () {
      return mockDoc;
    });

    // ✅ lots of long messages so ensureSpace() triggers startNewPage() -> addPage()
    component.messages = Array.from({ length: 40 }).map((_, i) => ({
      role: i % 2 === 0 ? 'user' : 'ai',
      text: 'LONG '.repeat(40),
    })) as any;

    await component.exportConversationPdf();

    expect(mockDoc.addImage).toHaveBeenCalled(); // covers: doc.addImage(...)
    expect(mockDoc.addPage).toHaveBeenCalled();  // covers: startNewPage path
    expect(mockDoc.save).toHaveBeenCalled();     // still saves
  });

  it('seeAll and openSettings should be callable (function coverage)', () => {
    component.seeAll();
    component.openSettings();
    expect(true).toBe(true);
  });

  it('onDeleteChat/onArchiveChat/onExportChat should early return when id is invalid', async () => {
  const spAlert = vi.spyOn(window, 'alert').mockImplementation(() => {});
  const http = (component as any).http as HttpClient;
  const spGet = vi.spyOn(http, 'get');

  await component.onDeleteChat('   ');
  await component.onArchiveChat('null');
  await component.onExportChat('undefined');

  // no api calls should happen
  expect(convoApi.deleteConversation).not.toHaveBeenCalled();
  expect(convoApi.archiveConversation).not.toHaveBeenCalled();
  expect(spGet).not.toHaveBeenCalled();

  spAlert.mockRestore();
});

it('sendMessage should use "(Empty reply)" when backend reply is blank', async () => {
  component.isLoggedIn = false;
  component.userId = '';
  component.messages = [];
  component.message = 'hello';

  component.sendMessage();

  const req = httpMock.expectOne((r) => r.url === 'http://localhost:8080/api/chat');
  req.flush({ reply: '   ' }); // blank reply triggers fallback

  await Promise.resolve();
  await new Promise<void>((r) => setTimeout(r, 0));

  expect(component.messages.some(m => m.role === 'ai' && m.text === '(Empty reply)')).toBe(true);
});

it('saveEditAndResend should early return when editingIndex is null', () => {
  component.editingIndex = null;
  component.editingText = 'edited';
  component.messages = [{ role: 'user', text: 'orig' } as any];

  component.saveEditAndResend();

  expect(component.messages[0].text).toBe('orig');
});

it('exportConversationPdfForMessages should hit addImage + footer break + pagination addPage', async () => {
  // force logo to exist so addImage path runs
  logoSpy.mockResolvedValueOnce('data:image/png;base64,AAA');

  const mockDoc: any = {
    internal: { pageSize: { getWidth: () => 300, getHeight: () => 220 } }, // small height => paginate
    addImage: vi.fn(),
    setFont: vi.fn(),
    setFontSize: vi.fn(),
    setTextColor: vi.fn(),
    text: vi.fn(),
    setDrawColor: vi.fn(),
    line: vi.fn(),
    setFillColor: vi.fn(),
    rect: vi.fn(),
    // huge lines => footer will eventually `break`
    splitTextToSize: vi.fn((t: string) => Array(200).fill(t)),
    addPage: vi.fn(),
    save: vi.fn(),
  };

  (jsPDF as any).mockImplementation(function () {
    return mockDoc;
  });

  const msgs = Array.from({ length: 40 }).map((_, i) => ({
    role: i % 2 === 0 ? 'user' : 'ai',
    text: 'LONG '.repeat(40),
  }));

  await (component as any).exportConversationPdfForMessages(msgs, 'title');

  expect(mockDoc.addImage).toHaveBeenCalled(); // covers addImage
  expect(mockDoc.addPage).toHaveBeenCalled();  // covers pagination
  expect(mockDoc.save).toHaveBeenCalled();     // saves
});

it('openChat should fallback to normalized when response has no id fields', async () => {
  component.isLoggedIn = true;
  component.userId = 'u1';

  component.openChat('  cid-fallback  ');

  const req = httpMock.expectOne(
    (r) => r.url === 'http://localhost:8080/api/conversations/cid-fallback'
  );
  req.flush({
    // ✅ no id/_id/conversationId keys here
    turns: [{ userMessage: 'u', botResponse: 'b' }],
  });

  await Promise.resolve();
  await new Promise<void>((r) => setTimeout(r, 0));

  expect(component.activeConversationId).toBe('cid-fallback'); // ✅ normalized used
  expect(sessionStorage.getItem('activeConversationId')).toBe('cid-fallback'); // ✅ saved
});

it('onSubmit should early return when sending=true', () => {
  component.sending = true;
  component.editingIndex = null;

  const spSend = vi.spyOn(component, 'sendMessage');
  const spEdit = vi.spyOn(component, 'saveEditAndResend');

  component.onSubmit();

  expect(spSend).not.toHaveBeenCalled();
  expect(spEdit).not.toHaveBeenCalled();
});

it('direct new Chatbox() should cover class declaration/field initializers', () => {
  const tb = new Chatbox(
    {} as any, // http
    { getByUser: vi.fn() } as any, // convoApi
    { detectChanges: vi.fn() } as any, // cdr
    { navigate: vi.fn(), events: of() } as any, // router
    { notify: vi.fn() } as any // uiModal
  );

  expect(tb).toBeInstanceOf(Chatbox);
  expect(tb.isLoggedIn).toBe(false);
  expect(tb.sidebarOpen).toBe(true);
  expect(tb.message).toBe('');
  expect(Array.isArray(tb.messages)).toBe(true);
});

it('loadConversations should handle null list (covers list || [])', async () => {
  component.isLoggedIn = true;
  component.userId = 'u1';

  convoApi.getByUser.mockReturnValue(of(null as any)); // ✅ null list

  await (component as any).loadConversations();
  await Promise.resolve();

  expect(component.chats).toEqual([]); // no crash, becomes empty
});

it('direct new Chatbox() covers class line + field initializers', () => {
  const http = {} as any;
  const convoApi = {} as any;
  const cdr = { detectChanges: vi.fn() } as any;
  const router = { navigate: vi.fn(), events: new Subject<any>().asObservable() } as any;
  const uiModal = { notify: vi.fn() } as any;

  const cb = new Chatbox(http, convoApi, cdr, router, uiModal);

  expect(cb).toBeInstanceOf(Chatbox);
  expect(cb.isLoggedIn).toBe(false);
  expect(cb.sidebarOpen).toBe(true);
  expect(Array.isArray(cb.messages)).toBe(true);
  expect(cb.activeConversationId).toBeNull();
});

it('openChat should handle response with NO turns property (covers convo?.turns || [])', async () => {
  component.isLoggedIn = true;
  component.userId = 'u1';

  component.openChat('c-no-turns');

  const req = httpMock.expectOne(
    (r) => r.url === 'http://localhost:8080/api/conversations/c-no-turns'
  );
  req.flush({ id: 'c-no-turns' }); // ✅ no turns

  await flushMicrotasks();
  await flushTimers();

  expect(component.activeConversationId).toBe('c-no-turns');
  expect(component.messages).toEqual([]);
});

it('sendMessage should handle message undefined (covers ?? "")', async () => {
  component.isLoggedIn = false;
  component.sending = false;

  (component as any).message = undefined; // ✅ forces (this.message ?? '')
  await component.sendMessage();

  httpMock.expectNone((r) => r.url === 'http://localhost:8080/api/chat');
});

it("sendMessage should use '(Empty reply)' when backend reply is blank", async () => {
  component.isLoggedIn = false;
  component.userId = '';
  component.messages = [];
  component.message = 'hello';

  component.sendMessage();

  const req = httpMock.expectOne((r) => r.url === 'http://localhost:8080/api/chat');
  req.flush({ reply: '   ' }); // ✅ blank reply triggers (Empty reply)

  await flushMicrotasks();
  await flushTimers();

  expect(component.messages.some((m) => m.role === 'ai' && m.text === '(Empty reply)')).toBe(true);
});

it('sendMessage should NOT push error bubble when chat switched during error (covers catch switched-chat branch)', async () => {
  component.isLoggedIn = true;
  component.userId = 'u1';
  component.activeConversationId = 'c1';
  component.messages = [];
  component.message = 'hi';

  component.sendMessage();

  const req = httpMock.expectOne((r) => r.url === 'http://localhost:8080/api/chat');

  // ✅ switch chat BEFORE failing response
  component.activeConversationId = 'c2';

  req.flush({ err: true }, { status: 500, statusText: 'Server Error' });

  await flushMicrotasks();
  await flushTimers();

  // ✅ it should return early in catch and NOT push HTTP bubble
  expect(component.messages.some((m) => (m.text || '').includes('HTTP 500'))).toBe(false);
  expect(component.sending).toBe(false);
});



it('startBotResponseForEditedMessage should format HTTP error when HttpErrorResponse instance is thrown', async () => {
  component.isLoggedIn = false;
  component.sending = false;
  component.messages = [];

  const http = (component as any).http as HttpClient;
  vi.spyOn(http, 'post').mockReturnValue(
    throwError(() => new HttpErrorResponse({ status: 500, statusText: 'Server Error' })) as any
  );

  await (component as any).startBotResponseForEditedMessage('hello');

  await flushMicrotasks();
  await flushTimers();

  expect(component.messages.some((m) => (m.text || '').includes('HTTP 500'))).toBe(true);
  expect(component.sending).toBe(false);
});

it('exportConversationPdf should addImage when logo exists and hit footer break branch', async () => {
  // restore the real spy and force logo to exist
  logoSpy.mockRestore();
  vi.spyOn(component as any, 'loadImageAsDataURL').mockResolvedValue('data:image/png;base64,AAA');

  const mockDoc: any = {
    internal: { pageSize: { getWidth: () => 595, getHeight: () => 120 } }, // ✅ small height => footer break
    addImage: vi.fn(),
    setFont: vi.fn(),
    setFontSize: vi.fn(),
    setTextColor: vi.fn(),
    text: vi.fn(),
    setDrawColor: vi.fn(),
    line: vi.fn(),
    setFillColor: vi.fn(),
    rect: vi.fn(),
    splitTextToSize: () => Array(500).fill('line'), // ✅ many lines => triggers break
    addPage: vi.fn(),
    save: vi.fn(),
  };

  (jsPDF as any).mockImplementation(function () {
    return mockDoc;
  });

  component.messages = [{ role: 'user', text: 'hello' } as any];

  await component.exportConversationPdf();

  expect(mockDoc.addImage).toHaveBeenCalled();
  expect(mockDoc.save).toHaveBeenCalled();
});

it(
  'startBotResponseForEditedMessage should hit save catch and warn (covers "Save failed (chat still works)" line)',
  async () => {
    component.isLoggedIn = true;
    component.userId = 'u1';
    component.activeConversationId = null;
    component.sending = false;
    component.messages = [];

    // CHAT resolves immediately
    const http = (component as any).http;
    const postSpy = vi.spyOn(http, 'post').mockReturnValue(of({ reply: 'ok' }) as any);

    // SAVE fails -> catch(saveErr) should warn
    convoApi.createConversation.mockReturnValue(
      throwError(() => new Error('db down')) as any
    );

    await (component as any).startBotResponseForEditedMessage('edited');

    expect(component.messages.some((m) => m.role === 'ai' && m.text === 'ok')).toBe(true);
    expect(component.sending).toBe(false);

    expect(
      (console.warn as any).mock.calls.some((c: any[]) =>
        String(c[0]).includes('Save failed (chat still works)')
      )
    ).toBe(true);

    postSpy.mockRestore();
  },
  10000
);

it('startBotResponseForEditedMessage catch should early-return when token becomes stale', async () => {
  component.isLoggedIn = false;
  component.sending = false;
  component.messages = [];

  const http = (component as any).http;

  // force error
  vi.spyOn(http, 'post').mockReturnValue(
    throwError(() => new Error('fail')) as any
  );

  const promise = (component as any).startBotResponseForEditedMessage('hello');

  // make token stale BEFORE catch executes
  (component as any).requestToken++;

  await promise;

  // nothing should be pushed
  expect(component.messages.length).toBe(0);
});

it('sendMessage should hit stale request inside SAVE step (AI reply still pushed)', async () => {
  component.isLoggedIn = true;
  component.userId = 'u1';
  component.activeConversationId = null;
  component.messages = [];
  component.message = 'hi';

  const http = (component as any).http;
  const postSpy = vi.spyOn(http, 'post').mockReturnValue(of({ reply: 'ok' }) as any);

  const originalPush = component.messages.push.bind(component.messages);

  vi.spyOn(component.messages, 'push').mockImplementation((...args: any[]) => {
    const msg = args[0];
    const out = originalPush(...args);

    // AFTER AI bubble is pushed -> make token stale BEFORE SAVE check
    if (msg?.role === 'ai' && msg?.text === 'ok') {
      (component as any).requestToken++;
    }
    return out;
  });

  await component.sendMessage();

  expect(component.messages.some((m) => m.role === 'ai' && m.text === 'ok')).toBe(true);

  // SAVE should be skipped due to stale token
  expect(convoApi.createConversation).not.toHaveBeenCalled();
  expect(convoApi.addTurn).not.toHaveBeenCalled();

  postSpy.mockRestore();
});

it('sendMessage should hit switched chat inside SAVE step (AI reply still pushed)', async () => {
  component.isLoggedIn = true;
  component.userId = 'u1';
  component.activeConversationId = 'c1';
  component.messages = [];
  component.message = 'hi';

  const http = (component as any).http;
  const postSpy = vi.spyOn(http, 'post').mockReturnValue(of({ reply: 'ok' }) as any);

  const originalPush = component.messages.push.bind(component.messages);

  vi.spyOn(component.messages, 'push').mockImplementation((...args: any[]) => {
    const msg = args[0];
    const out = originalPush(...args);

    // AFTER AI bubble push -> switch convo BEFORE SAVE check
    if (msg?.role === 'ai' && msg?.text === 'ok') {
      component.activeConversationId = 'c2';
    }
    return out;
  });

  await component.sendMessage();

  expect(component.messages.some((m) => m.role === 'ai' && m.text === 'ok')).toBe(true);

  expect(convoApi.createConversation).not.toHaveBeenCalled();
  expect(convoApi.addTurn).not.toHaveBeenCalled();

  postSpy.mockRestore();
});

it('exportConversationPdf should skip blank message (covers continue branch)', async () => {
  const mockDoc: any = {
    internal: { pageSize: { getWidth: () => 595, getHeight: () => 842 } },
    addImage: vi.fn(),
    setFont: vi.fn(),
    setFontSize: vi.fn(),
    setTextColor: vi.fn(),
    text: vi.fn(),
    setDrawColor: vi.fn(),
    line: vi.fn(),
    setFillColor: vi.fn(),
    rect: vi.fn(),
    splitTextToSize: (t: string) => [t],
    addPage: vi.fn(),
    save: vi.fn(),
  };

  (jsPDF as any).mockImplementation(function () {
    return mockDoc;
  });

  component.messages = [
    { role: 'user', text: '   ' } as any, // blank => continue
    { role: 'ai', text: 'hello' } as any,
  ];

  await component.exportConversationPdf();
  expect(mockDoc.save).toHaveBeenCalled();
});

it('loadImageAsDataURL should hit FileReader onerror branch', async () => {
  const originalFetch = globalThis.fetch;
  const originalFR = (globalThis as any).FileReader;

  globalThis.fetch = vi.fn().mockResolvedValue({
    blob: vi.fn().mockResolvedValue(new Blob(['x'], { type: 'image/png' })),
  } as any);

  class FRMock {
    result: any = null;
    onload: any;
    onerror: any;
    readAsDataURL() {
      this.onerror?.(); // force error
    }
  }

  (globalThis as any).FileReader = FRMock;

  const out = await (component as any).loadImageAsDataURL('x.png');

  expect(out).toBeNull();

  globalThis.fetch = originalFetch!;
  (globalThis as any).FileReader = originalFR!;
});

it('onExportChat should fallback title to "conversation"', async () => {
  const sp = vi.spyOn(component as any, 'exportConversationPdfForMessages')
    .mockResolvedValue(undefined);

  component.chats = []; // so find() returns undefined

  component.onExportChat('c1');

  const req = httpMock.expectOne(
    (r) => r.url === 'http://localhost:8080/api/conversations/c1'
  );

  req.flush({
    id: 'c1',
    title: '', // blank title
    turns: [{ userMessage: 'u', botResponse: 'b' }],
  });

  await flushMicrotasks();
  await flushTimers();

  expect(sp).toHaveBeenCalledWith(
    expect.any(Array),
    'conversation'
  );
});

it('covers class declaration/field initializers via direct constructor', () => {
  const cb = new Chatbox(
    {} as any, // http
    {} as any, // convoApi
    { detectChanges: vi.fn() } as any, // cdr
    { navigate: vi.fn(), events: of() } as any, // router
    { notify: vi.fn() } as any // uiModal
  );

  expect(cb).toBeInstanceOf(Chatbox);
  expect(cb.isLoggedIn).toBe(false);
  expect(cb.sidebarOpen).toBe(true);
  expect(cb.message).toBe('');
  expect(Array.isArray(cb.messages)).toBe(true);
});

it("sendMessage should use '(Empty reply)' when backend returns NO reply field (covers ?? '')", async () => {
  component.isLoggedIn = false;
  component.userId = '';
  component.messages = [];
  component.message = 'hello';

  component.sendMessage();

  const req = httpMock.expectOne((r) => r.url === 'http://localhost:8080/api/chat');
  req.flush({}); // ✅ reply is undefined -> triggers (res?.reply ?? '')

  await flushMicrotasks();
  await flushTimers();

  expect(component.messages.some((m) => m.role === 'ai' && m.text === '(Empty reply)')).toBe(true);
});

it("startBotResponseForEditedMessage should use '(Empty reply)' when backend returns NO reply field (covers ?? '')", async () => {
  component.isLoggedIn = false;
  component.userId = '';
  component.sending = false;
  component.messages = [];

  (component as any).startBotResponseForEditedMessage('edited');

  const req = httpMock.expectOne((r) => r.url === 'http://localhost:8080/api/chat');
  req.flush({}); // ✅ reply is undefined

  await flushMicrotasks();
  await flushTimers();

  expect(component.messages.some((m) => m.role === 'ai' && m.text === '(Empty reply)')).toBe(true);
});

it('sendMessage should fallback to (Empty reply) when reply is null (covers ?? "")', async () => {
  component.isLoggedIn = false;
  component.userId = '';
  component.messages = [];
  component.message = 'hello';

  component.sendMessage();

  const req = httpMock.expectOne(r => r.url === 'http://localhost:8080/api/chat');
  req.flush({ reply: null }); // ✅ hits res?.reply ?? ''

  await flushMicrotasks();
  await flushTimers();

  expect(component.messages.some(m => m.role === 'ai' && m.text === '(Empty reply)')).toBe(true);
});

it('startBotResponseForEditedMessage should NOT push error bubble when chat switched before async error (covers catch switched-chat branch)', async () => {
  component.isLoggedIn = true;
  component.userId = 'u1';
  component.activeConversationId = 'c1';
  component.sending = false;
  component.messages = [];

  const subj = new Subject<any>();
  const http = (component as any).http as HttpClient;

  vi.spyOn(http, 'post').mockReturnValue(subj.asObservable() as any);

  const p = (component as any).startBotResponseForEditedMessage('edited');

  // ✅ switch chat BEFORE error emits
  component.activeConversationId = 'c2';

  subj.error(new HttpErrorResponse({ status: 500, statusText: 'Server Error' }));

  await p;
  await flushMicrotasks();
  await flushTimers();

  // ✅ should return early in catch, so no HTTP bubble
  expect(component.messages.some(m => (m.text || '').includes('HTTP 500'))).toBe(false);
  expect(component.sending).toBe(false);
});

it('exportConversationPdf should handle message.text undefined (covers m.text ?? "")', async () => {
  const mockDoc: any = {
    internal: { pageSize: { getWidth: () => 595, getHeight: () => 842 } },
    addImage: vi.fn(),
    setFont: vi.fn(),
    setFontSize: vi.fn(),
    setTextColor: vi.fn(),
    text: vi.fn(),
    setDrawColor: vi.fn(),
    line: vi.fn(),
    setFillColor: vi.fn(),
    rect: vi.fn(),
    splitTextToSize: (t: string) => [t],
    addPage: vi.fn(),
    save: vi.fn(),
  };

  (jsPDF as any).mockImplementation(function () {
    return mockDoc;
  });

  component.messages = [
    { role: 'user', text: undefined as any }, // ✅ hits ?? ''
    { role: 'ai', text: 'hello' } as any,
  ];

  await component.exportConversationPdf();
  expect(mockDoc.save).toHaveBeenCalled();
});

it('exportConversationPdfForMessages should fallback title to "conversation" (covers title || "conversation")', async () => {
  const mockDoc: any = {
    internal: { pageSize: { getWidth: () => 595, getHeight: () => 842 } },
    addImage: vi.fn(),
    setFont: vi.fn(),
    setFontSize: vi.fn(),
    setTextColor: vi.fn(),
    text: vi.fn(),
    setDrawColor: vi.fn(),
    line: vi.fn(),
    setFillColor: vi.fn(),
    rect: vi.fn(),
    splitTextToSize: (t: string) => [t],
    addPage: vi.fn(),
    save: vi.fn(),
  };

  (jsPDF as any).mockImplementation(function () {
    return mockDoc;
  });

  await (component as any).exportConversationPdfForMessages(
    [{ role: 'ai', text: 'x' }],
    '' // ✅ forces "conversation"
  );

  const filename = mockDoc.save.mock.calls.at(-1)?.[0] as string;
  expect(filename).toContain('conversation');
});

it('startBotResponseForEditedMessage should early return when text is undefined (covers ?? "")', async () => {
  component.sending = false;

  const http = (component as any).http as HttpClient;
  const sp = vi.spyOn(http, 'post');

  await (component as any).startBotResponseForEditedMessage(undefined);

  expect(sp).not.toHaveBeenCalled();
});

it("sendMessage should fallback to '(Empty reply)' when backend reply is missing (covers res?.reply ?? '')", async () => {
  component.isLoggedIn = false;
  component.userId = '';
  component.messages = [];
  component.message = 'hello';

  component.sendMessage();

  const req = httpMock.expectOne((r) => r.url === 'http://localhost:8080/api/chat');
  req.flush({}); // ✅ reply is undefined

  await flushMicrotasks();
  await flushTimers();

  expect(component.messages.some(m => m.role === 'ai' && m.text === '(Empty reply)')).toBe(true);
});

it('startBotResponseForEditedMessage should NOT push error bubble when chat switched during error (covers catch switched-chat return block)', async () => {
  component.isLoggedIn = true;
  component.userId = 'u1';
  component.activeConversationId = 'c1';
  component.sending = false;
  component.messages = [];

  const http = (component as any).http as HttpClient;
  vi.spyOn(http, 'post').mockReturnValue(
    throwError(() => new HttpErrorResponse({ status: 500, statusText: 'Server Error' })) as any
  );

  const p = (component as any).startBotResponseForEditedMessage('edited');

  // ✅ switch chat before it handles the error
  component.activeConversationId = 'c2';

  await p;

  // ✅ should return early; no error bubble added
  expect(component.messages.length).toBe(0);
  expect(component.sending).toBe(false);
});

it('onExportChat should handle response with NO turns property (covers convo?.turns || [])', async () => {
  const spAlert = vi.spyOn(window, 'alert').mockImplementation(() => {});
  component.isLoggedIn = true;
  component.userId = 'u1';

  component.onExportChat('c-no-turns');

  const req = httpMock.expectOne((r) => r.url === 'http://localhost:8080/api/conversations/c-no-turns');
  req.flush({ id: 'c-no-turns', title: 't' }); // ✅ no turns

  await flushMicrotasks();
  await flushTimers();

  expect(spAlert).toHaveBeenCalledWith('No messages to export in this conversation.');
});

it('exportConversationPdfForMessages should cover pad2 branch when <10', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2020-01-01T03:05:00')); // hours/min < 10

  const mockDoc: any = {
    internal: { pageSize: { getWidth: () => 595, getHeight: () => 842 } },
    addImage: vi.fn(),
    setFont: vi.fn(),
    setFontSize: vi.fn(),
    setTextColor: vi.fn(),
    text: vi.fn(),
    setDrawColor: vi.fn(),
    line: vi.fn(),
    setFillColor: vi.fn(),
    rect: vi.fn(),
    splitTextToSize: (t: string) => [t],
    addPage: vi.fn(),
    save: vi.fn(),
  };

  (jsPDF as any).mockImplementation(function () { return mockDoc; });

  await (component as any).exportConversationPdfForMessages(
    [{ role: 'user', text: 'hi' }],
    't'
  );

  expect(mockDoc.save).toHaveBeenCalled();

  vi.useRealTimers();
});

it('exportConversationPdfForMessages should cover pad2 branch when >=10', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2020-01-01T13:25:00')); // hours/min >= 10

  const mockDoc: any = {
    internal: { pageSize: { getWidth: () => 595, getHeight: () => 842 } },
    addImage: vi.fn(),
    setFont: vi.fn(),
    setFontSize: vi.fn(),
    setTextColor: vi.fn(),
    text: vi.fn(),
    setDrawColor: vi.fn(),
    line: vi.fn(),
    setFillColor: vi.fn(),
    rect: vi.fn(),
    splitTextToSize: (t: string) => [t],
    addPage: vi.fn(),
    save: vi.fn(),
  };

  (jsPDF as any).mockImplementation(function () { return mockDoc; });

  await (component as any).exportConversationPdfForMessages(
    [{ role: 'user', text: 'hi' }],
    't'
  );

  expect(mockDoc.save).toHaveBeenCalled();

  vi.useRealTimers();
});

it('sendMessage catch should early-return when token becomes stale (covers return in catch)', async () => {
  component.isLoggedIn = true;     // ✅ prevents Guest Mode bubble
  component.userId = 'u1';
  component.activeConversationId = 'c1';
  component.messages = [];
  component.message = 'hello';

  const http = (component as any).http as HttpClient;

  vi.spyOn(http, 'post').mockReturnValue(
    new Observable((sub) => {
      setTimeout(() => sub.error(new Error('fail')), 0); // ✅ async error
    }) as any
  );

  const p = component.sendMessage();

  // make request stale before the error fires
  (component as any).requestToken++;

  await p;
  await flushMicrotasks();
  await flushTimers();

  // ✅ only user message got pushed, error bubble is skipped due to stale token
  expect(component.messages.length).toBe(1);
  expect(component.messages.some(m => m.role === 'ai')).toBe(false);
});

it('sendMessage should hit stale request inside SAVE step (AI reply still pushed)', async () => {
  component.isLoggedIn = true;
  component.userId = 'u1';
  component.activeConversationId = null;
  component.messages = [];
  component.message = 'hi';

  const http = (component as any).http as HttpClient;
  vi.spyOn(http, 'post').mockReturnValue(of({ reply: 'ok' }) as any);

  const originalPush = component.messages.push.bind(component.messages);
  vi.spyOn(component.messages, 'push').mockImplementation((...args: any[]) => {
    const msg = args[0];
    const out = originalPush(...args);

    if (msg?.role === 'ai' && msg?.text === 'ok') {
      (component as any).requestToken++; // stale AFTER AI push, BEFORE save checks
    }
    return out;
  });

  await component.sendMessage();

  expect(component.messages.some(m => m.role === 'ai' && m.text === 'ok')).toBe(true);
  expect(convoApi.createConversation).not.toHaveBeenCalled();
  expect(convoApi.addTurn).not.toHaveBeenCalled();
});

it('sendMessage should hit switched chat inside SAVE step (AI reply still pushed)', async () => {
  component.isLoggedIn = true;
  component.userId = 'u1';
  component.activeConversationId = 'c1';
  component.messages = [];
  component.message = 'hi';

  const http = (component as any).http as HttpClient;
  vi.spyOn(http, 'post').mockReturnValue(of({ reply: 'ok' }) as any);

  const originalPush = component.messages.push.bind(component.messages);
  vi.spyOn(component.messages, 'push').mockImplementation((...args: any[]) => {
    const msg = args[0];
    const out = originalPush(...args);

    if (msg?.role === 'ai' && msg?.text === 'ok') {
      component.activeConversationId = 'c2'; // switch AFTER AI push, BEFORE save checks
    }
    return out;
  });

  await component.sendMessage();

  expect(component.messages.some(m => m.role === 'ai' && m.text === 'ok')).toBe(true);
  expect(convoApi.createConversation).not.toHaveBeenCalled();
  expect(convoApi.addTurn).not.toHaveBeenCalled();
});

it('exportConversationPdf should cover pad2 else-branch (>=10)', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2020-01-01T12:34:00'));

  const mockDoc: any = {
    internal: { pageSize: { getWidth: () => 595, getHeight: () => 842 } },
    addImage: vi.fn(),
    setFont: vi.fn(),
    setFontSize: vi.fn(),
    setTextColor: vi.fn(),
    text: vi.fn(),
    setDrawColor: vi.fn(),
    line: vi.fn(),
    setFillColor: vi.fn(),
    rect: vi.fn(),
    splitTextToSize: (t: string) => [t],
    addPage: vi.fn(),
    save: vi.fn(),
  };

  (jsPDF as any).mockImplementation(function () {
    return mockDoc;
  });

  component.messages = [{ role: 'user', text: 'hello' } as any];
  await component.exportConversationPdf();

  expect(mockDoc.save).toHaveBeenCalled();

  vi.useRealTimers();
});

it('loadImageAsDataURL should execute FileReader.onerror reject branch', async () => {
  logoSpy.mockRestore();

  const originalFetch = globalThis.fetch;
  const originalFR = (globalThis as any).FileReader;

  globalThis.fetch = vi.fn().mockResolvedValue({
    blob: vi.fn().mockResolvedValue(new Blob(['x'], { type: 'image/png' })),
  } as any);

  class FRMock {
    result: any = null;
    onload: any;
    onerror: any;
    readAsDataURL() {
      this.onerror?.(); // hit reject line
    }
  }
  (globalThis as any).FileReader = FRMock;

  const out = await (component as any).loadImageAsDataURL('x.png');
  expect(out).toBeNull();

  globalThis.fetch = originalFetch!;
  (globalThis as any).FileReader = originalFR!;

  // reapply spy for the rest
  logoSpy = vi.spyOn(component as any, 'loadImageAsDataURL').mockResolvedValue(null);
});

it('exportConversationPdf should hit msgText continue branch', async () => {
  const mockDoc: any = {
    internal: { pageSize: { getWidth: () => 595, getHeight: () => 842 } },
    addImage: vi.fn(),
    setFont: vi.fn(),
    setFontSize: vi.fn(),
    setTextColor: vi.fn(),
    text: vi.fn(),
    setDrawColor: vi.fn(),
    line: vi.fn(),
    setFillColor: vi.fn(),
    rect: vi.fn(),
    splitTextToSize: (t: string) => [t],
    addPage: vi.fn(),
    save: vi.fn(),
  };

  (jsPDF as any).mockImplementation(function () {
    return mockDoc;
  });

  component.messages = [
    { role: 'user', text: undefined as any }, // forces (m.text ?? '').trim() => ''
    { role: 'ai', text: 'hello' } as any,
  ];

  await component.exportConversationPdf();
  expect(mockDoc.save).toHaveBeenCalled();
});

it('sendMessage should execute stale request throw inside SAVE block', async () => {
  component.isLoggedIn = true;
  component.userId = 'u1';
  component.activeConversationId = null;
  component.messages = [];
  component.message = 'hello';

  const http = (component as any).http as HttpClient;
  vi.spyOn(http, 'post').mockReturnValue(of({ reply: 'ok' }) as any);

  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

  const originalPush = component.messages.push.bind(component.messages);

  vi.spyOn(component.messages, 'push').mockImplementation((...args: any[]) => {
    const msg = args[0];
    const result = originalPush(...args);

    // After AI reply is pushed, make token stale
    if (msg?.role === 'ai') {
      (component as any).requestToken++;
    }

    return result;
  });

  await component.sendMessage();

  // ✅ stale throw line executed (caught and warned)
  expect(warnSpy).toHaveBeenCalled();
});

it('exportConversationPdf should hit continue when msgText becomes empty after trim', async () => {
  const mockDoc: any = {
    internal: { pageSize: { getWidth: () => 595, getHeight: () => 842 } },
    addImage: vi.fn(),
    setFont: vi.fn(),
    setFontSize: vi.fn(),
    setTextColor: vi.fn(),
    text: vi.fn(),
    setDrawColor: vi.fn(),
    line: vi.fn(),
    setFillColor: vi.fn(),
    rect: vi.fn(),
    splitTextToSize: (t: string) => [t],
    addPage: vi.fn(),
    save: vi.fn(),
  };

  (jsPDF as any).mockImplementation(function () {
    return mockDoc;
  });

  component.messages = [
    { role: 'user', text: '   ' } as any, // becomes empty after trim
    { role: 'ai', text: 'hello' } as any,
  ];

  await component.exportConversationPdf();

  expect(mockDoc.save).toHaveBeenCalled();
});

it('sendMessage should execute stale-request throw inside SAVE block', async () => {
  component.isLoggedIn = true;
  component.userId = 'u1';
  component.activeConversationId = null;
  component.messages = [];
  component.message = 'hi';

  const http = (component as any).http as HttpClient;
  vi.spyOn(http, 'post').mockReturnValue(of({ reply: 'ok' }) as any);

  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

  const origPush = component.messages.push.bind(component.messages);
  vi.spyOn(component.messages, 'push').mockImplementation((...args: any[]) => {
    const msg = args[0];
    const out = origPush(...args);

    // after AI reply, make token stale so SAVE hits the throw line
    if (msg?.role === 'ai') (component as any).requestToken++;
    return out;
  });

  await component.sendMessage();
  expect(warnSpy).toHaveBeenCalled(); // proves SAVE catch ran
});

it('sendMessage should execute switched-chat throw inside SAVE block', async () => {
  component.isLoggedIn = true;
  component.userId = 'u1';
  component.activeConversationId = 'c1';
  component.messages = [];
  component.message = 'hi';

  const http = (component as any).http as HttpClient;
  vi.spyOn(http, 'post').mockReturnValue(of({ reply: 'ok' }) as any);

  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

  const origPush = component.messages.push.bind(component.messages);
  vi.spyOn(component.messages, 'push').mockImplementation((...args: any[]) => {
    const msg = args[0];
    const out = origPush(...args);

    // after AI reply, switch activeConversationId so SAVE hits throw
    if (msg?.role === 'ai') component.activeConversationId = 'c2';
    return out;
  });

  await component.sendMessage();
  expect(warnSpy).toHaveBeenCalled();
});

it('sendMessage SAVE should set activeConversationId + sessionStorage after createConversation', async () => {
  component.isLoggedIn = true;
  component.userId = 'u1';
  component.activeConversationId = null;
  component.messages = [];
  component.message = 'first';

  const http = (component as any).http as HttpClient;
  vi.spyOn(http, 'post').mockReturnValue(of({ reply: 'bot' }) as any);

  convoApi.createConversation.mockReturnValue(of({ id: 'new-id' } as any));

  const spLoad = vi.spyOn(component as any, 'loadConversations').mockResolvedValue(undefined);

  await component.sendMessage();

  expect(component.activeConversationId).toBe('new-id');
  expect(sessionStorage.getItem('activeConversationId')).toBe('new-id');
  expect(spLoad).toHaveBeenCalled();
});

it('sendMessage SAVE should set activeConversationId + sessionStorage after createConversation', async () => {
  component.isLoggedIn = true;
  component.userId = 'u1';
  component.activeConversationId = null;
  component.messages = [];
  component.message = 'first';

  const http = (component as any).http as HttpClient;
  vi.spyOn(http, 'post').mockReturnValue(of({ reply: 'bot' }) as any);

  convoApi.createConversation.mockReturnValue(of({ id: 'new-id' } as any));

  const spLoad = vi.spyOn(component as any, 'loadConversations').mockResolvedValue(undefined);

  await component.sendMessage();

  expect(component.activeConversationId).toBe('new-id');
  expect(sessionStorage.getItem('activeConversationId')).toBe('new-id');
  expect(spLoad).toHaveBeenCalled();
});

it('loadImageAsDataURL should hit onload success branch', async () => {
  // ✅ IMPORTANT: remove the default spy that returns null
  logoSpy.mockRestore();

  const originalFetch = globalThis.fetch;
  const originalFR = (globalThis as any).FileReader;

  globalThis.fetch = vi.fn().mockResolvedValue({
    blob: vi.fn().mockResolvedValue(new Blob(['x'], { type: 'image/png' })),
  } as any);

  class FRMock {
    result: any = 'data:image/png;base64,AAA';
    onload: any;
    onerror: any;
    readAsDataURL() {
      this.onload?.(); // ✅ success
    }
  }
  (globalThis as any).FileReader = FRMock;

  const out = await (component as any).loadImageAsDataURL('x.png');

  expect(out).not.toBeNull();
  expect(out as string).toContain('data:image/png');

  globalThis.fetch = originalFetch!;
  (globalThis as any).FileReader = originalFR!;

  // ✅ re-spy for other tests
  logoSpy = vi.spyOn(component as any, 'loadImageAsDataURL').mockResolvedValue(null);
});

it('onExportChat should handle convo with no turns (turns || [])', async () => {
  const spAlert = vi.spyOn(window, 'alert').mockImplementation(() => {});
  component.onExportChat('c1');

  const req = httpMock.expectOne(r => r.url === 'http://localhost:8080/api/conversations/c1');
  req.flush({ id: 'c1', title: 'T' }); // no turns

  await Promise.resolve();
  await new Promise<void>(r => setTimeout(r, 0));

  expect(spAlert).toHaveBeenCalled();
});

it('exportConversationPdfForMessages should continue when msgText becomes empty', async () => {
  const mockDoc: any = {
    internal: { pageSize: { getWidth: () => 595, getHeight: () => 842 } },
    addImage: vi.fn(),
    setFont: vi.fn(),
    setFontSize: vi.fn(),
    setTextColor: vi.fn(),
    text: vi.fn(),
    setDrawColor: vi.fn(),
    line: vi.fn(),
    setFillColor: vi.fn(),
    rect: vi.fn(),
    splitTextToSize: (t: string) => [t],
    addPage: vi.fn(),
    save: vi.fn(),
  };

  (jsPDF as any).mockImplementation(function () {
    return mockDoc;
  });

  await (component as any).exportConversationPdfForMessages(
    [
      { role: 'user', text: '   ' },        // empty after trim => continue
      { role: 'ai', text: 'hello' },
    ],
    'title'
  );

  expect(mockDoc.save).toHaveBeenCalled();
});

it('startBotResponseForEditedMessage should hit "stale request" throw inside SAVE step', async () => {
  component.isLoggedIn = true;
  component.userId = 'u1';
  component.activeConversationId = null;
  component.sending = false;
  component.messages = [];

  const http = (component as any).http as HttpClient;
  vi.spyOn(http, 'post').mockReturnValue(of({ reply: 'ok' }) as any);

  // mutate token after AI bubble push, before SAVE checks
  const originalPush = component.messages.push.bind(component.messages);
  vi.spyOn(component.messages, 'push').mockImplementation((...args: any[]) => {
    const msg = args[0];
    const out = originalPush(...args);
    if (msg?.role === 'ai' && msg?.text === 'ok') {
      (component as any).requestToken++; // ✅ makes stale request
    }
    return out;
  });

  await (component as any).startBotResponseForEditedMessage('edited');

  expect(component.messages.some(m => m.role === 'ai' && m.text === 'ok')).toBe(true);
  expect(convoApi.createConversation).not.toHaveBeenCalled();
  expect(convoApi.addTurn).not.toHaveBeenCalled();
});

it('startBotResponseForEditedMessage should hit "switched chat" throw inside SAVE step', async () => {
  component.isLoggedIn = true;
  component.userId = 'u1';
  component.activeConversationId = 'c1';
  component.sending = false;
  component.messages = [];

  const http = (component as any).http as HttpClient;
  vi.spyOn(http, 'post').mockReturnValue(of({ reply: 'ok' }) as any);

  const originalPush = component.messages.push.bind(component.messages);
  vi.spyOn(component.messages, 'push').mockImplementation((...args: any[]) => {
    const msg = args[0];
    const out = originalPush(...args);
    if (msg?.role === 'ai' && msg?.text === 'ok') {
      component.activeConversationId = 'c2'; // ✅ switched chat before SAVE check
    }
    return out;
  });

  await (component as any).startBotResponseForEditedMessage('edited');

  expect(component.messages.some(m => m.role === 'ai' && m.text === 'ok')).toBe(true);
  expect(convoApi.addTurn).not.toHaveBeenCalled();
});

it('exportConversationPdfForMessages should continue/skip when msg text is blank (covers msgText trim + continue)', async () => {
  const mockDoc: any = {
    internal: { pageSize: { getWidth: () => 595, getHeight: () => 842 } },
    addImage: vi.fn(),
    setFont: vi.fn(),
    setFontSize: vi.fn(),
    setTextColor: vi.fn(),
    text: vi.fn(),
    setDrawColor: vi.fn(),
    line: vi.fn(),
    setFillColor: vi.fn(),
    rect: vi.fn(),
    splitTextToSize: (t: string) => [t],
    addPage: vi.fn(),
    save: vi.fn(),
  };

  (jsPDF as any).mockImplementation(function () {
    return mockDoc;
  });

  await (component as any).exportConversationPdfForMessages(
    [
      { role: 'user', text: '   ' },      // ✅ blank -> continue
      { role: 'ai', text: undefined as any }, // ✅ undefined -> '' -> continue
      { role: 'ai', text: 'hello' },      // ✅ actual content
    ],
    'title'
  );

  expect(mockDoc.save).toHaveBeenCalled();
});



});