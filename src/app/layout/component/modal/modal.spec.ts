// modal.spec.ts (Vitest) — 100% coverage for Modal

import { TestBed, ComponentFixture } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA, ChangeDetectorRef } from '@angular/core';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { Modal } from './modal';
import { ConversationService } from '../../../services/conversation';
import { UiModalService } from '../../../shared/ui-modal/ui-modal.service';

type MockConvoApi = {
  getByUser: ReturnType<typeof vi.fn>;
  unarchiveConversation: ReturnType<typeof vi.fn>;
  deleteConversation: ReturnType<typeof vi.fn>;
};

type MockUiModal = {
  confirm: ReturnType<typeof vi.fn>;
  notify: ReturnType<typeof vi.fn>;
};

const makeConvoApi = (): MockConvoApi => ({
  getByUser: vi.fn(),
  unarchiveConversation: vi.fn(),
  deleteConversation: vi.fn(),
});

const makeUiModal = (): MockUiModal => ({
  confirm: vi.fn(),
  notify: vi.fn(),
});

const makeCdr = () =>
  ({
    detectChanges: vi.fn(),
  }) as unknown as ChangeDetectorRef;

async function setup(opts?: {
  userId?: string;
  convoApi?: MockConvoApi;
  uiModal?: MockUiModal;
}) {
  const convoApi = opts?.convoApi ?? makeConvoApi();
  const uiModal = opts?.uiModal ?? makeUiModal();

  TestBed.resetTestingModule();

  await TestBed.configureTestingModule({
    imports: [Modal],
    providers: [
      provideRouter([]),
      { provide: ConversationService, useValue: convoApi },
      { provide: UiModalService, useValue: uiModal },
      { provide: ChangeDetectorRef, useValue: makeCdr() },
    ],
    schemas: [NO_ERRORS_SCHEMA],
  }).compileComponents();

  const fixture = TestBed.createComponent(Modal);
  const component = fixture.componentInstance;
  const router = TestBed.inject(Router);
  const cdr = TestBed.inject(ChangeDetectorRef) as any;

  component.userId = opts?.userId ?? '';
  return { fixture, component, router, convoApi, uiModal, cdr };
}

describe('Modal (Vitest) - full coverage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should create', async () => {
    const { component } = await setup();
    expect(component).toBeTruthy();
  });

  it('ngOnInit calls loadArchived', async () => {
    const { component } = await setup();
    const spy = vi.spyOn(component as any, 'loadArchived').mockResolvedValue(undefined);
    await component.ngOnInit();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('onClose emits close', async () => {
    const { component } = await setup();
    const spy = vi.fn();
    component.close.subscribe(spy);

    component.onClose();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('extractId picks conversationId then id then _id', async () => {
    const { component } = await setup();
    const c: any = component;

    expect(c.extractId({ conversationId: 'a' })).toBe('a');
    expect(c.extractId({ id: 'b' })).toBe('b');
    expect(c.extractId({ _id: 'c' })).toBe('c');
    expect(c.extractId({})).toBeNull();
    expect(c.extractId(null)).toBeNull();
  });

  it('formatDate handles empty and produces formatted string', async () => {
    const { component } = await setup();
    const c: any = component;

    expect(c.formatDate(undefined)).toBe('');
    // fixed date (ISO)
    const out = c.formatDate('2026-02-25T00:00:00.000Z');
    expect(typeof out).toBe('string');
    expect(out.length).toBeGreaterThan(0);
  });

  it('loadArchived: no userId -> rows empty and returns', async () => {
    const { component, convoApi } = await setup({ userId: '' });

    component.rows = [{ id: 'x', title: 't', date: 'd', checked: true }];
    await component.loadArchived();

    expect(component.rows).toEqual([]);
    expect(convoApi.getByUser).not.toHaveBeenCalled();
  });

 it('loadArchived: success -> only archived rows mapped + filtered', async () => {
  const convoApi = makeConvoApi();
  const uiModal = makeUiModal();
  const { component } = await setup({ userId: 'u1', convoApi, uiModal });

  // ✅ spy the real instance used by the component
  const detectSpy = vi.spyOn((component as any).cdr, 'detectChanges');

  convoApi.getByUser.mockReturnValue(
    of([
      { id: '1', title: 'Keep', archived: true, createdAt: '2026-02-01T00:00:00.000Z' },
      { id: '2', title: 'Skip', archived: false, createdAt: '2026-02-02T00:00:00.000Z' },
      { conversationId: '3', title: '', archived: true, createdAt: undefined },
      { archived: true }, // no id -> filtered out
    ] as any)
  );

  await component.loadArchived();

  expect(component.loading).toBe(false);
  expect(component.rows.length).toBe(2);
  expect(component.rows[0].id).toBe('1');
  expect(component.rows[0].title).toBe('Keep');
  expect(component.rows[0].checked).toBe(false);

  expect(component.rows[1].id).toBe('3');
  expect(component.rows[1].title).toBe('(Untitled)');
  expect(component.rows[1].date).toBe('');

  expect(uiModal.notify).not.toHaveBeenCalled();
  expect(detectSpy).toHaveBeenCalled(); // ✅ now this will pass
});

  it('loadArchived: error -> rows empty + notify danger', async () => {
    const convoApi = makeConvoApi();
    const uiModal = makeUiModal();
    const { component } = await setup({ userId: 'u1', convoApi, uiModal });

    convoApi.getByUser.mockReturnValue(throwError(() => new Error('boom')));
    uiModal.notify.mockResolvedValue(undefined);

    await component.loadArchived();

    expect(component.rows).toEqual([]);
    expect(uiModal.notify).toHaveBeenCalledTimes(1);
    const arg = uiModal.notify.mock.calls[0][0];
    expect(arg.title).toBe('Load failed');
    expect(arg.variant).toBe('danger');
  });

  it('allChecked getter: true only when rows non-empty and all checked', async () => {
    const { component } = await setup();

    component.rows = [];
    expect(component.allChecked).toBe(false);

    component.rows = [
      { id: '1', title: 'A', date: '', checked: true },
      { id: '2', title: 'B', date: '', checked: true },
    ];
    expect(component.allChecked).toBe(true);

    component.rows[1].checked = false;
    expect(component.allChecked).toBe(false);
  });

  it('toggleAll sets checked for all rows', async () => {
    const { component } = await setup();

    component.rows = [
      { id: '1', title: 'A', date: '', checked: false },
      { id: '2', title: 'B', date: '', checked: true },
    ];

    component.toggleAll(true);
    expect(component.rows.every((r) => r.checked)).toBe(true);

    component.toggleAll(false);
    expect(component.rows.every((r) => !r.checked)).toBe(true);
  });

  it('goToPreview navigates with query param', async () => {
    const { component, router } = await setup();
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true as any);

    component.goToPreview({ id: 'c1', title: 'T', date: '', checked: false });

    expect(navSpy).toHaveBeenCalledWith(['/preview-archive'], {
      queryParams: { id: 'c1' },
    });
  });

  it('unarchiveOne: stopPropagation + confirm=false -> does nothing', async () => {
    const convoApi = makeConvoApi();
    const uiModal = makeUiModal();
    const { component } = await setup({ userId: 'u1', convoApi, uiModal });

    component.rows = [{ id: '1', title: 'A', date: '', checked: false }];

    uiModal.confirm.mockResolvedValue(false);

    const ev = { stopPropagation: vi.fn() } as any;
    await component.unarchiveOne(component.rows[0], ev);

    expect(ev.stopPropagation).toHaveBeenCalledTimes(1);
    expect(convoApi.unarchiveConversation).not.toHaveBeenCalled();
    expect(uiModal.notify).not.toHaveBeenCalled();
  });

  it('unarchiveOne: success -> removes row + emits changed + notify success', async () => {
    const convoApi = makeConvoApi();
    const uiModal = makeUiModal();
    const { component } = await setup({ userId: 'u1', convoApi, uiModal });

    component.rows = [
      { id: '1', title: 'A', date: '', checked: false },
      { id: '2', title: 'B', date: '', checked: false },
    ];

    uiModal.confirm.mockResolvedValue(true);
    convoApi.unarchiveConversation.mockReturnValue(of({ ok: true } as any));
    uiModal.notify.mockResolvedValue(undefined);

    const changedSpy = vi.fn();
    component.changed.subscribe(changedSpy);

    await component.unarchiveOne(component.rows[0]);

    expect(convoApi.unarchiveConversation).toHaveBeenCalledWith('1');
    expect(component.rows.map((r) => r.id)).toEqual(['2']);
    expect(changedSpy).toHaveBeenCalledTimes(1);

    expect(uiModal.notify).toHaveBeenCalled();
    const arg = uiModal.notify.mock.calls.at(-1)?.[0];
    expect(arg.title).toBe('Restored');
    expect(arg.variant).toBe('success');
  });

  it('unarchiveOne: error -> notify danger', async () => {
    const convoApi = makeConvoApi();
    const uiModal = makeUiModal();
    const { component } = await setup({ userId: 'u1', convoApi, uiModal });

    component.rows = [{ id: '1', title: 'A', date: '', checked: false }];

    uiModal.confirm.mockResolvedValue(true);
    convoApi.unarchiveConversation.mockReturnValue(throwError(() => new Error('fail')));
    uiModal.notify.mockResolvedValue(undefined);

    await component.unarchiveOne(component.rows[0]);

    const arg = uiModal.notify.mock.calls.at(-1)?.[0];
    expect(arg.title).toBe('Restore failed');
    expect(arg.variant).toBe('danger');
  });

  it('deleteOne: confirm=false -> does nothing', async () => {
    const convoApi = makeConvoApi();
    const uiModal = makeUiModal();
    const { component } = await setup({ userId: 'u1', convoApi, uiModal });

    component.rows = [{ id: '1', title: 'A', date: '', checked: false }];

    uiModal.confirm.mockResolvedValue(false);

    await component.deleteOne(component.rows[0]);

    expect(convoApi.deleteConversation).not.toHaveBeenCalled();
    expect(uiModal.notify).not.toHaveBeenCalled();
  });

  it('deleteOne: success -> removes row + emits changed + notify success', async () => {
    const convoApi = makeConvoApi();
    const uiModal = makeUiModal();
    const { component } = await setup({ userId: 'u1', convoApi, uiModal });

    component.rows = [
      { id: '1', title: 'A', date: '', checked: false },
      { id: '2', title: 'B', date: '', checked: false },
    ];

    uiModal.confirm.mockResolvedValue(true);
    convoApi.deleteConversation.mockReturnValue(of({ ok: true } as any));
    uiModal.notify.mockResolvedValue(undefined);

    const changedSpy = vi.fn();
    component.changed.subscribe(changedSpy);

    await component.deleteOne(component.rows[0]);

    expect(convoApi.deleteConversation).toHaveBeenCalledWith('1');
    expect(component.rows.map((r) => r.id)).toEqual(['2']);
    expect(changedSpy).toHaveBeenCalledTimes(1);

    const arg = uiModal.notify.mock.calls.at(-1)?.[0];
    expect(arg.title).toBe('Deleted');
    expect(arg.variant).toBe('success');
  });

  it('deleteOne: error -> notify danger', async () => {
    const convoApi = makeConvoApi();
    const uiModal = makeUiModal();
    const { component } = await setup({ userId: 'u1', convoApi, uiModal });

    component.rows = [{ id: '1', title: 'A', date: '', checked: false }];

    uiModal.confirm.mockResolvedValue(true);
    convoApi.deleteConversation.mockReturnValue(throwError(() => new Error('fail')));
    uiModal.notify.mockResolvedValue(undefined);

    await component.deleteOne(component.rows[0]);

    const arg = uiModal.notify.mock.calls.at(-1)?.[0];
    expect(arg.title).toBe('Delete failed');
    expect(arg.variant).toBe('danger');
  });

  it('unarchiveSelected: none checked -> returns', async () => {
    const convoApi = makeConvoApi();
    const uiModal = makeUiModal();
    const { component } = await setup({ userId: 'u1', convoApi, uiModal });

    component.rows = [
      { id: '1', title: 'A', date: '', checked: false },
      { id: '2', title: 'B', date: '', checked: false },
    ];

    await component.unarchiveSelected();

    expect(uiModal.confirm).not.toHaveBeenCalled();
    expect(convoApi.unarchiveConversation).not.toHaveBeenCalled();
  });

  it('unarchiveSelected: confirm=false -> no calls', async () => {
    const convoApi = makeConvoApi();
    const uiModal = makeUiModal();
    const { component } = await setup({ userId: 'u1', convoApi, uiModal });

    component.rows = [
      { id: '1', title: 'A', date: '', checked: true },
      { id: '2', title: 'B', date: '', checked: false },
    ];

    uiModal.confirm.mockResolvedValue(false);

    await component.unarchiveSelected();

    expect(convoApi.unarchiveConversation).not.toHaveBeenCalled();
  });

  it('unarchiveSelected: success -> unarchives each, removes checked, emits changed, notify', async () => {
    const convoApi = makeConvoApi();
    const uiModal = makeUiModal();
    const { component } = await setup({ userId: 'u1', convoApi, uiModal });

    component.rows = [
      { id: '1', title: 'A', date: '', checked: true },
      { id: '2', title: 'B', date: '', checked: true },
      { id: '3', title: 'C', date: '', checked: false },
    ];

    uiModal.confirm.mockResolvedValue(true);
    convoApi.unarchiveConversation.mockReturnValue(of({ ok: true } as any));
    uiModal.notify.mockResolvedValue(undefined);

    const changedSpy = vi.fn();
    component.changed.subscribe(changedSpy);

    await component.unarchiveSelected();

    expect(convoApi.unarchiveConversation).toHaveBeenCalledTimes(2);
    expect(component.rows.map((r) => r.id)).toEqual(['3']);
    expect(changedSpy).toHaveBeenCalledTimes(1);

    const arg = uiModal.notify.mock.calls.at(-1)?.[0];
    expect(arg.title).toBe('Restored');
    expect(arg.variant).toBe('success');
  });

  it('unarchiveSelected: error -> notify danger', async () => {
    const convoApi = makeConvoApi();
    const uiModal = makeUiModal();
    const { component } = await setup({ userId: 'u1', convoApi, uiModal });

    component.rows = [
      { id: '1', title: 'A', date: '', checked: true },
      { id: '2', title: 'B', date: '', checked: true },
    ];

    uiModal.confirm.mockResolvedValue(true);
    convoApi.unarchiveConversation
      .mockReturnValueOnce(of({ ok: true } as any))
      .mockReturnValueOnce(throwError(() => new Error('fail')));
    uiModal.notify.mockResolvedValue(undefined);

    await component.unarchiveSelected();

    const arg = uiModal.notify.mock.calls.at(-1)?.[0];
    expect(arg.title).toBe('Restore failed');
    expect(arg.variant).toBe('danger');
  });

  it('deleteSelected: none checked -> returns', async () => {
    const convoApi = makeConvoApi();
    const uiModal = makeUiModal();
    const { component } = await setup({ userId: 'u1', convoApi, uiModal });

    component.rows = [
      { id: '1', title: 'A', date: '', checked: false },
      { id: '2', title: 'B', date: '', checked: false },
    ];

    await component.deleteSelected();

    expect(uiModal.confirm).not.toHaveBeenCalled();
    expect(convoApi.deleteConversation).not.toHaveBeenCalled();
  });

  it('deleteSelected: confirm=false -> no calls', async () => {
    const convoApi = makeConvoApi();
    const uiModal = makeUiModal();
    const { component } = await setup({ userId: 'u1', convoApi, uiModal });

    component.rows = [
      { id: '1', title: 'A', date: '', checked: true },
      { id: '2', title: 'B', date: '', checked: false },
    ];

    uiModal.confirm.mockResolvedValue(false);

    await component.deleteSelected();

    expect(convoApi.deleteConversation).not.toHaveBeenCalled();
  });

  it('deleteSelected: success -> deletes each, removes checked, emits changed, notify', async () => {
    const convoApi = makeConvoApi();
    const uiModal = makeUiModal();
    const { component } = await setup({ userId: 'u1', convoApi, uiModal });

    component.rows = [
      { id: '1', title: 'A', date: '', checked: true },
      { id: '2', title: 'B', date: '', checked: true },
      { id: '3', title: 'C', date: '', checked: false },
    ];

    uiModal.confirm.mockResolvedValue(true);
    convoApi.deleteConversation.mockReturnValue(of({ ok: true } as any));
    uiModal.notify.mockResolvedValue(undefined);

    const changedSpy = vi.fn();
    component.changed.subscribe(changedSpy);

    await component.deleteSelected();

    expect(convoApi.deleteConversation).toHaveBeenCalledTimes(2);
    expect(component.rows.map((r) => r.id)).toEqual(['3']);
    expect(changedSpy).toHaveBeenCalledTimes(1);

    const arg = uiModal.notify.mock.calls.at(-1)?.[0];
    expect(arg.title).toBe('Deleted');
    expect(arg.variant).toBe('success');
  });

  it('deleteSelected: error -> notify danger', async () => {
    const convoApi = makeConvoApi();
    const uiModal = makeUiModal();
    const { component } = await setup({ userId: 'u1', convoApi, uiModal });

    component.rows = [
      { id: '1', title: 'A', date: '', checked: true },
      { id: '2', title: 'B', date: '', checked: true },
    ];

    uiModal.confirm.mockResolvedValue(true);
    convoApi.deleteConversation
      .mockReturnValueOnce(of({ ok: true } as any))
      .mockReturnValueOnce(throwError(() => new Error('fail')));
    uiModal.notify.mockResolvedValue(undefined);

    await component.deleteSelected();

    const arg = uiModal.notify.mock.calls.at(-1)?.[0];
    expect(arg.title).toBe('Delete failed');
    expect(arg.variant).toBe('danger');
  });
});