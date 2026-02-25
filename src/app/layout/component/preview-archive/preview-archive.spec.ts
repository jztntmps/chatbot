// preview-archive.spec.ts (Vitest)

import { TestBed, ComponentFixture } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA, ChangeDetectorRef } from '@angular/core';
import { Router, ActivatedRoute, provideRouter, convertToParamMap } from '@angular/router';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';

import { PreviewArchive } from './preview-archive';
import { ConversationService } from '../../../services/conversation';

type MockConvoApi = {
  getByUser: ReturnType<typeof vi.fn>;
  getConversation: ReturnType<typeof vi.fn>;
  unarchiveConversation: ReturnType<typeof vi.fn>;
};

const makeRoute = (id: string | null): Partial<ActivatedRoute> => ({
  snapshot: {
    queryParamMap: convertToParamMap(id ? { id } : {}),
  } as any,
});

const makeConvoApi = (): MockConvoApi => ({
  getByUser: vi.fn(),
  getConversation: vi.fn(),
  unarchiveConversation: vi.fn(),
});

const makeCdr = () =>
  ({
    detectChanges: vi.fn(),
  }) as unknown as ChangeDetectorRef;

async function setup(opts?: {
  routeId?: string | null;
  convoApi?: MockConvoApi;
}) {
  const routeId = opts?.routeId ?? null;
  const convoApi = opts?.convoApi ?? makeConvoApi();

  TestBed.resetTestingModule();

  await TestBed.configureTestingModule({
    imports: [PreviewArchive],
    providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: makeRoute(routeId) },
      { provide: ConversationService, useValue: convoApi },
      { provide: ChangeDetectorRef, useValue: makeCdr() },
    ],
    schemas: [NO_ERRORS_SCHEMA], // ✅ ignores app-topbar/app-sidebar/app-footer tags
  }).compileComponents();

  const fixture = TestBed.createComponent(PreviewArchive);
  const component = fixture.componentInstance;
  const router = TestBed.inject(Router);
  const cdr = TestBed.inject(ChangeDetectorRef) as any;

  return { fixture, component, router, convoApi, cdr };
}

describe('PreviewArchive (Vitest) - full coverage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('should create', async () => {
    const { component } = await setup();
    expect(component).toBeTruthy();
  });

  it('normalizeId should handle null/blank/null-string/undefined-string/valid', async () => {
    const { component } = await setup();
    const c: any = component;

    expect(c.normalizeId(null)).toBeNull();
    expect(c.normalizeId('')).toBeNull();
    expect(c.normalizeId('   ')).toBeNull();
    expect(c.normalizeId('null')).toBeNull();
    expect(c.normalizeId('undefined')).toBeNull();
    expect(c.normalizeId('  abc  ')).toBe('abc');
  });

  it('extractConversationId should pick the first available id field', async () => {
    const { component } = await setup();
    const c: any = component;

    expect(c.extractConversationId({ id: 'a' })).toBe('a');
    expect(c.extractConversationId({ _id: 'b' })).toBe('b');
    expect(c.extractConversationId({ conversationId: 'c' })).toBe('c');
    expect(c.extractConversationId({ conversationID: 'd' })).toBe('d');
    expect(c.extractConversationId({ conversation_id: 'e' })).toBe('e');
    expect(c.extractConversationId({})).toBeNull();
    expect(c.extractConversationId(null)).toBeNull();
  });

  it('ngOnInit: logged-out flow (no loadConversations, no loadConversation)', async () => {
    const { component } = await setup({ routeId: null });

    const loadConversationsSpy = vi.spyOn(component as any, 'loadConversations').mockResolvedValue(undefined);
    const loadConversationSpy = vi.spyOn(component as any, 'loadConversation').mockResolvedValue(undefined);

    await component.ngOnInit();

    expect(component.isLoggedIn).toBe(false);
    expect(component.userEmail).toBe('User');
    expect(component.userId).toBe('');
    expect(component.conversationId).toBeNull();

    expect(loadConversationsSpy).not.toHaveBeenCalled();
    expect(loadConversationSpy).not.toHaveBeenCalled();
  });

  it('ngOnInit: logged-in + has userId -> loads conversations; has id param -> loads conversation', async () => {
    localStorage.setItem('isLoggedIn', 'true');
    localStorage.setItem('userEmail', 'test@example.com');
    localStorage.setItem('userId', 'u123');

    const { component } = await setup({ routeId: 'cid1' });

    const loadConversationsSpy = vi.spyOn(component as any, 'loadConversations').mockResolvedValue(undefined);
    const loadConversationSpy = vi.spyOn(component as any, 'loadConversation').mockResolvedValue(undefined);

    await component.ngOnInit();

    expect(component.isLoggedIn).toBe(true);
    expect(component.userEmail).toBe('test@example.com');
    expect(component.userId).toBe('u123');
    expect(component.conversationId).toBe('cid1');

    expect(loadConversationsSpy).toHaveBeenCalledTimes(1);
    expect(loadConversationSpy).toHaveBeenCalledWith('cid1');
  });

  it('loadConversations: success -> filters archived and maps ids', async () => {
    const convoApi = makeConvoApi();
    const { component } = await setup({ convoApi });

    component.userId = 'u123';
    component.isLoggedIn = true;

    convoApi.getByUser.mockReturnValue(
      of([
        { id: '1', title: 'A', archived: false },
        { _id: '2', title: 'B', archived: true },
        { conversationId: '3', title: '', archived: false },
        { conversationID: '4', archived: false },
        { conversation_id: '5', title: 'E', archived: false },
        { archived: false }, // no id -> removed
      ])
    );

    await component.loadConversations();

    expect(component.chats).toEqual([
      { id: '1', title: 'A' },
      { id: '3', title: '(Untitled)' },
      { id: '4', title: '(Untitled)' },
      { id: '5', title: 'E' },
    ]);
  });

  it('loadConversations: error -> empty chats', async () => {
    const convoApi = makeConvoApi();
    const { component } = await setup({ convoApi });

    component.userId = 'u123';
    component.isLoggedIn = true;

    convoApi.getByUser.mockReturnValue(throwError(() => new Error('boom')));

    await component.loadConversations();

    expect(component.chats).toEqual([]);
  });

  it('loadConversation: ignores invalid ids', async () => {
    const convoApi = makeConvoApi();
    const { component } = await setup({ convoApi });

    await component.loadConversation('   ');
    await component.loadConversation('null');
    await component.loadConversation('undefined');

    expect(convoApi.getConversation).not.toHaveBeenCalled();
  });

  it('loadConversation: success -> rebuilds messages from turns', async () => {
    const convoApi = makeConvoApi();
    const { component } = await setup({ convoApi });

    convoApi.getConversation.mockReturnValue(
      of({
        turns: [
          { userMessage: 'hi', botResponse: 'hello' },
          { userMessage: '2nd', botResponse: '' },
          { userMessage: '', botResponse: 'only bot' },
        ],
      } as any)
    );

    await component.loadConversation('cid1');

    expect(component.messages).toEqual([
      { role: 'user', text: 'hi' },
      { role: 'ai', text: 'hello' },
      { role: 'user', text: '2nd' },
      { role: 'ai', text: 'only bot' },
    ]);
    expect(component.loading).toBe(false);
  });

  it('loadConversation: error -> shows warning bubble', async () => {
    const convoApi = makeConvoApi();
    const { component } = await setup({ convoApi });

    convoApi.getConversation.mockReturnValue(throwError(() => new Error('fail')));

    await component.loadConversation('cid1');

    expect(component.messages).toEqual([{ role: 'ai', text: '⚠️ Failed to load archived chat.' }]);
    expect(component.loading).toBe(false);
  });

  it('openChat/startNewChat/goLogin/goSignup/goArchive/seeAll/toggleSidebar/logout', async () => {
    const { component, router } = await setup();

    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true as any);

    component.openChat('x1');
    expect(navSpy).toHaveBeenLastCalledWith(['/chatbox'], { queryParams: { id: 'x1' } });

    component.startNewChat();
    expect(navSpy).toHaveBeenLastCalledWith(['/chatbox']);

    component.goLogin();
    expect(navSpy).toHaveBeenLastCalledWith(['/indexlogin']);

    component.goSignup();
    expect(navSpy).toHaveBeenLastCalledWith(['/signup']);

    // no-op for coverage
    component.seeAll();
    component.goArchive();

    const prev = component.sidebarOpen;
    component.toggleSidebar();
    expect(component.sidebarOpen).toBe(!prev);

    localStorage.setItem('isLoggedIn', 'true');
    localStorage.setItem('userEmail', 'a@b.com');
    localStorage.setItem('userId', 'u1');
    localStorage.setItem('activeConversationId', 'c1');

    component.logout();

    expect(localStorage.getItem('isLoggedIn')).toBeNull();
    expect(localStorage.getItem('userEmail')).toBeNull();
    expect(localStorage.getItem('userId')).toBeNull();
    expect(localStorage.getItem('activeConversationId')).toBeNull();

    expect(navSpy).toHaveBeenLastCalledWith(['/']);
  });

  it('unarchiveConversation: no conversationId -> does nothing', async () => {
    const convoApi = makeConvoApi();
    const { component, router } = await setup({ convoApi });

    component.conversationId = null;

    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true as any);

    await component.unarchiveConversation();

    expect(convoApi.unarchiveConversation).not.toHaveBeenCalled();
    expect(navSpy).not.toHaveBeenCalled();
  });

  it('unarchiveConversation: success -> sets activeConversationId and navigates', async () => {
    const convoApi = makeConvoApi();
    const { component, router } = await setup({ convoApi });

    component.conversationId = 'cid99';
    convoApi.unarchiveConversation.mockReturnValue(of({ ok: true }));

    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true as any);

    await component.unarchiveConversation();

    expect(convoApi.unarchiveConversation).toHaveBeenCalledWith('cid99');
    expect(localStorage.getItem('activeConversationId')).toBe('cid99');
    expect(navSpy).toHaveBeenCalledWith(['/chatbox'], { queryParams: { id: 'cid99' } });
  });

  it('unarchiveConversation: error -> alerts', async () => {
    const convoApi = makeConvoApi();
    const { component, router } = await setup({ convoApi });

    component.conversationId = 'cid_err';
    convoApi.unarchiveConversation.mockReturnValue(throwError(() => new Error('nope')));

    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true as any);
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    await component.unarchiveConversation();

    expect(alertSpy).toHaveBeenCalledWith('Failed to unarchive conversation.');
    expect(navSpy).not.toHaveBeenCalledWith(['/chatbox'], expect.anything());
  });
});