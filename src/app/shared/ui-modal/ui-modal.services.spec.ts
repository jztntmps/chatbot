import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { firstValueFrom } from 'rxjs';
import { take } from 'rxjs/operators';

import { UiModalService } from './ui-modal.service';
import type { UiModalState } from './ui-modal.service';

describe('UiModalService (100%)', () => {
  let service: UiModalService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(UiModalService);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  async function getStateOnce(): Promise<UiModalState> {
    return firstValueFrom(service.modal$.pipe(take(1)));
  }

  async function getOpenStateOrThrow() {
    const s = await getStateOnce();
    expect(s.open).toBe(true);
    if (!s.open) throw new Error('Expected open state');
    return s;
  }

  it('should start closed', async () => {
    const s = await getStateOnce();
    expect(s.open).toBe(false);
  });

  it('close() should set state to closed (manual resolve old confirm promise)', async () => {
    const p = service.confirm({ title: 'T', message: 'M' });

    const openState = await getOpenStateOrThrow();
    const resolver = openState._resolve!;
    expect(typeof resolver).toBe('function');

    service.close();

    const closed = await getStateOnce();
    expect(closed.open).toBe(false);

    resolver(false);
    await expect(p).resolves.toBe(false);
  });

  it('confirm() should apply defaults when optional fields are missing', async () => {
    const p = service.confirm({ title: 'Hello', message: 'World' });

    const s = await getOpenStateOrThrow();
    expect(s.title).toBe('Hello');
    expect(s.message).toBe('World');

    expect(s.variant).toBe('neutral');
    expect(s.icon).toBe('question');
    expect(s.cancelText).toBe('Cancel');
    expect(s.confirmText).toBe('OK');
    expect(s.showCancel).toBe(true);

    service._resolve(true);
    await expect(p).resolves.toBe(true);

    const closed = await getStateOnce();
    expect(closed.open).toBe(false);
  });

  it('confirm() should also default when explicit undefined is passed', async () => {
    const p = service.confirm({
      title: 'U',
      message: 'U',
      variant: undefined,
      icon: undefined,
      cancelText: undefined,
      confirmText: undefined,
      showCancel: undefined,
    });

    const s = await getOpenStateOrThrow();
    expect(s.variant).toBe('neutral');
    expect(s.icon).toBe('question');
    expect(s.cancelText).toBe('Cancel');
    expect(s.confirmText).toBe('OK');
    expect(s.showCancel).toBe(true);

    service._resolve(false);
    await expect(p).resolves.toBe(false);
  });

  it('confirm() should respect provided options', async () => {
    const p = service.confirm({
      title: 'Danger',
      message: 'Are you sure?',
      variant: 'danger',
      icon: 'warning',
      cancelText: 'No',
      confirmText: 'Yes',
      showCancel: false,
    });

    const s = await getOpenStateOrThrow();
    expect(s.variant).toBe('danger');
    expect(s.icon).toBe('warning');
    expect(s.cancelText).toBe('No');
    expect(s.confirmText).toBe('Yes');
    expect(s.showCancel).toBe(false);

    service._resolve(false);
    await expect(p).resolves.toBe(false);
  });

  it('notify() should default fields when not provided (variant/icon/confirmText) and ms defaults to 0', async () => {
    const p = service.notify({
      title: 'Saved',
      message: 'Done',
    });

    const s = await getOpenStateOrThrow();
    expect(s.variant).toBe('success');
    expect(s.icon).toBe('success');
    expect(s.confirmText).toBe('OK');
    expect(s.showCancel).toBe(false);

    service._resolve(true);
    await expect(p).resolves.toBeUndefined();

    const closed = await getStateOnce();
    expect(closed.open).toBe(false);
  });

  it('notify() should respect provided options (variant/icon/confirmText)', async () => {
    const p = service.notify({
      title: 'Warn',
      message: 'Heads up',
      variant: 'neutral',
      icon: 'question',
      confirmText: 'Got it',
      autoCloseMs: 0,
    });

    const s = await getOpenStateOrThrow();
    expect(s.variant).toBe('neutral');
    expect(s.icon).toBe('question');
    expect(s.confirmText).toBe('Got it');
    expect(s.showCancel).toBe(false);

    service._resolve(true);
    await expect(p).resolves.toBeUndefined();

    const closed = await getStateOnce();
    expect(closed.open).toBe(false);
  });

  it('notify() ms>0 should close if still open and resolve', async () => {
    const closeSpy = vi.spyOn(service, 'close');

    const p = service.notify({
      title: 'AutoClose',
      message: 'Closes after ms',
      autoCloseMs: 500,
    });

    await getOpenStateOrThrow();

    await vi.advanceTimersByTimeAsync(500);

    await expect(p).resolves.toBeUndefined();
    expect(closeSpy).toHaveBeenCalled();

    const closed = await getStateOnce();
    expect(closed.open).toBe(false);
  });

  it('notify() ms>0 should NOT call close in timer when already closed', async () => {
    const closeSpy = vi.spyOn(service, 'close');

    const p = service.notify({
      title: 'AutoClose',
      message: 'Will not close (already closed)',
      autoCloseMs: 300,
    });

    await getOpenStateOrThrow();

    service.close();
    const nowClosed = await getStateOnce();
    expect(nowClosed.open).toBe(false);

    await vi.advanceTimersByTimeAsync(300);

    await expect(p).resolves.toBeUndefined();
    expect(closeSpy.mock.calls.length).toBe(1);
  });

  it('_resolve(result) should resolve and close when open and _resolve exists', async () => {
    const p = service.confirm({ title: 'X', message: 'Y' });
    await getOpenStateOrThrow();

    service._resolve(true);
    await expect(p).resolves.toBe(true);

    const closed = await getStateOnce();
    expect(closed.open).toBe(false);
  });

  it('_resolve(result) should still close when open but _resolve is missing', async () => {
    (service as any).state$.next({
      open: true,
      title: 'No resolver',
      message: 'No resolver',
      variant: 'neutral',
      icon: 'question',
      showCancel: true,
      confirmText: 'OK',
      cancelText: 'Cancel',
    });

    const open = await getOpenStateOrThrow();
    expect((open as any)._resolve).toBeUndefined();

    expect(() => service._resolve(false)).not.toThrow();

    const closed = await getStateOnce();
    expect(closed.open).toBe(false);
  });

  it('_resolve(result) should not throw when already closed', async () => {
    const s = await getStateOnce();
    expect(s.open).toBe(false);

    expect(() => service._resolve(false)).not.toThrow();

    const after = await getStateOnce();
    expect(after.open).toBe(false);
  });

  it('notify() finish guard should resolve only once even if _resolve called twice', async () => {
    const p = service.notify({
      title: 'Once',
      message: 'Finish once',
      autoCloseMs: 0,
    });

    await getOpenStateOrThrow();

    service._resolve(true);
    service._resolve(true);

    await expect(p).resolves.toBeUndefined();
  });

  it('notify() autoClose should resolve even if user resolves earlier', async () => {
    const p = service.notify({
      title: 'Timer',
      message: 'Will be resolved early',
      autoCloseMs: 200,
    });

    await getOpenStateOrThrow();

    service._resolve(true);
    await expect(p).resolves.toBeUndefined();

    await vi.advanceTimersByTimeAsync(200);

    const closed = await getStateOnce();
    expect(closed.open).toBe(false);
  });

  it('confirm() should default when explicit null is passed (covers ?? with null)', async () => {
  const p = service.confirm({
    title: 'N',
    message: 'N',
    variant: null as any,
    icon: null as any,
    cancelText: null as any,
    confirmText: null as any,
    showCancel: null as any,
  });

  const s = await getOpenStateOrThrow();
  expect(s.variant).toBe('neutral');
  expect(s.icon).toBe('question');
  expect(s.cancelText).toBe('Cancel');
  expect(s.confirmText).toBe('OK');
  expect(s.showCancel).toBe(true);

  service._resolve(true);
  await expect(p).resolves.toBe(true);
});

it('notify() should default when explicit null is passed (covers ?? with null)', async () => {
  const p = service.notify({
    title: 'Nulls',
    message: 'Nulls',
    variant: null as any,
    icon: null as any,
    confirmText: null as any,
    autoCloseMs: null as any,
  });

  const s = await getOpenStateOrThrow();
  expect(s.variant).toBe('success');
  expect(s.icon).toBe('success');
  expect(s.confirmText).toBe('OK');
  expect(s.showCancel).toBe(false);

  service._resolve(true);
  await expect(p).resolves.toBeUndefined();
});

});