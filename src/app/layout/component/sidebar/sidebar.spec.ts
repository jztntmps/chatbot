// sidebar.spec.ts (Vitest) — 100% coverage for SidebarComponent

import { TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { SidebarComponent } from './sidebar';
import { UiModalService } from '../../../shared/ui-modal/ui-modal.service';

type MockUiModal = {
  confirm: ReturnType<typeof vi.fn>;
};

const makeUiModal = (): MockUiModal => ({
  confirm: vi.fn(),
});

async function setup(opts?: { confirmResult?: boolean }) {
  const uiModal = makeUiModal();
  if (typeof opts?.confirmResult === 'boolean') uiModal.confirm.mockResolvedValue(opts.confirmResult);

  TestBed.resetTestingModule();

  await TestBed.configureTestingModule({
    imports: [SidebarComponent],
    providers: [{ provide: UiModalService, useValue: uiModal }],
    schemas: [NO_ERRORS_SCHEMA], // ignore <app-modal> template if needed
  }).compileComponents();

  const fixture = TestBed.createComponent(SidebarComponent);
  const component = fixture.componentInstance;
  return { fixture, component, uiModal };
}

describe('SidebarComponent (Vitest) - full coverage', () => {
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

  it('profileInitial: uses first letter uppercase or U fallback', async () => {
    const { component } = await setup();

    component.username = 'harold';
    expect(component.profileInitial).toBe('H');

    component.username = '';
    expect(component.profileInitial).toBe('U');

    component.username = 'a';
    expect(component.profileInitial).toBe('A');
  });

  it('trackById returns chat id', async () => {
    const { component } = await setup();
    expect(component.trackById(0, { id: 'c1', title: 'T' })).toBe('c1');
  });

  it('toggleSettings toggles settingsOpen and clears openMenuId', async () => {
    const { component } = await setup();
    component.openMenuId = 'x';
    component.settingsOpen = false;

    component.toggleSettings();
    expect(component.settingsOpen).toBe(true);
    expect(component.openMenuId).toBeNull();

    component.openMenuId = 'y';
    component.toggleSettings();
    expect(component.settingsOpen).toBe(false);
    expect(component.openMenuId).toBeNull();
  });

  it('toggleSeeAll toggles showAll, closes settings, clears menu, emits seeAll', async () => {
    const { component } = await setup();

    const seeAllSpy = vi.fn();
    component.seeAll.subscribe(seeAllSpy);

    component.settingsOpen = true;
    component.openMenuId = 'x';
    component.showAll = false;

    component.toggleSeeAll();

    expect(component.showAll).toBe(true);
    expect(component.settingsOpen).toBe(false);
    expect(component.openMenuId).toBeNull();
    expect(seeAllSpy).toHaveBeenCalledTimes(1);
  });

  it('exportChat closes settings/menu and emits exportChatId', async () => {
    const { component } = await setup();

    const exportSpy = vi.fn();
    component.exportChatId.subscribe(exportSpy);

    component.settingsOpen = true;
    component.openMenuId = 'x';

    component.exportChat('cid1');

    expect(component.settingsOpen).toBe(false);
    expect(component.openMenuId).toBeNull();
    expect(exportSpy).toHaveBeenCalledWith('cid1');
  });

  it('clickArchive opens modal, closes settings/menu, emits archive', async () => {
    const { component } = await setup();

    const archiveSpy = vi.fn();
    component.archive.subscribe(archiveSpy);

    component.settingsOpen = true;
    component.openMenuId = 'x';
    component.showModal = false;

    component.clickArchive();

    expect(component.settingsOpen).toBe(false);
    expect(component.openMenuId).toBeNull();
    expect(component.showModal).toBe(true);
    expect(archiveSpy).toHaveBeenCalledTimes(1);
  });

  it('clickLogout confirm=false -> no emit', async () => {
    const { component, uiModal } = await setup({ confirmResult: false });

    const logoutSpy = vi.fn();
    component.logout.subscribe(logoutSpy);

    component.settingsOpen = true;
    component.openMenuId = 'x';

    await component.clickLogout();

    expect(component.settingsOpen).toBe(false);
    expect(component.openMenuId).toBeNull();
    expect(uiModal.confirm).toHaveBeenCalledTimes(1);
    expect(logoutSpy).not.toHaveBeenCalled();
  });

  it('clickLogout confirm=true -> emits logout', async () => {
    const { component, uiModal } = await setup({ confirmResult: true });

    const logoutSpy = vi.fn();
    component.logout.subscribe(logoutSpy);

    await component.clickLogout();

    expect(uiModal.confirm).toHaveBeenCalledTimes(1);
    expect(logoutSpy).toHaveBeenCalledTimes(1);
  });

  it('selectChat emits openChat and closes settings/menu', async () => {
    const { component } = await setup();

    const openChatSpy = vi.fn();
    component.openChat.subscribe(openChatSpy);

    component.settingsOpen = true;
    component.openMenuId = 'x';

    component.selectChat('cid1');

    expect(openChatSpy).toHaveBeenCalledWith('cid1');
    expect(component.settingsOpen).toBe(false);
    expect(component.openMenuId).toBeNull();
  });

  it('closeModal sets showModal false', async () => {
    const { component } = await setup();
    component.showModal = true;
    component.closeModal();
    expect(component.showModal).toBe(false);
  });

  it('openDots stops propagation, closes settings, toggles openMenuId', async () => {
    const { component } = await setup();

    const ev = { stopPropagation: vi.fn() } as any;

    component.settingsOpen = true;
    component.openMenuId = null;

    component.openDots(ev, 'c1');
    expect(ev.stopPropagation).toHaveBeenCalledTimes(1);
    expect(component.settingsOpen).toBe(false);
    expect(component.openMenuId).toBe('c1');

    // toggle off if same id
    component.openDots(ev, 'c1');
    expect(component.openMenuId).toBeNull();
  });

  it('archiveChat confirm=false -> no emit', async () => {
    const { component, uiModal } = await setup({ confirmResult: false });

    const spy = vi.fn();
    component.archiveChatId.subscribe(spy);

    component.openMenuId = 'c1';
    await component.archiveChat('c1');

    expect(uiModal.confirm).toHaveBeenCalledTimes(1);
    expect(component.openMenuId).toBe('c1'); // not cleared if cancelled
    expect(spy).not.toHaveBeenCalled();
  });

  it('archiveChat confirm=true -> clears openMenuId and emits archiveChatId', async () => {
    const { component, uiModal } = await setup({ confirmResult: true });

    const spy = vi.fn();
    component.archiveChatId.subscribe(spy);

    component.openMenuId = 'c1';
    await component.archiveChat('c1');

    expect(uiModal.confirm).toHaveBeenCalledTimes(1);
    expect(component.openMenuId).toBeNull();
    expect(spy).toHaveBeenCalledWith('c1');
  });

  it('deleteChat confirm=false -> no emit', async () => {
    const { component, uiModal } = await setup({ confirmResult: false });

    const spy = vi.fn();
    component.deleteChatId.subscribe(spy);

    component.openMenuId = 'c1';
    await component.deleteChat('c1');

    expect(uiModal.confirm).toHaveBeenCalledTimes(1);
    expect(component.openMenuId).toBe('c1');
    expect(spy).not.toHaveBeenCalled();
  });

  it('deleteChat confirm=true -> clears openMenuId and emits deleteChatId', async () => {
    const { component, uiModal } = await setup({ confirmResult: true });

    const spy = vi.fn();
    component.deleteChatId.subscribe(spy);

    component.openMenuId = 'c1';
    await component.deleteChat('c1');

    expect(uiModal.confirm).toHaveBeenCalledTimes(1);
    expect(component.openMenuId).toBeNull();
    expect(spy).toHaveBeenCalledWith('c1');
  });

  it('onDocClick closes menu and settings', async () => {
    const { component } = await setup();
    component.openMenuId = 'x';
    component.settingsOpen = true;

    component.onDocClick();

    expect(component.openMenuId).toBeNull();
    expect(component.settingsOpen).toBe(false);
  });

  it('onArchiveChanged closes modal and emits refreshChats', async () => {
    const { component } = await setup();

    const spy = vi.fn();
    component.refreshChats.subscribe(spy);

    component.showModal = true;

    component.onArchiveChanged();

    expect(component.showModal).toBe(false);
    expect(spy).toHaveBeenCalledTimes(1);
  });
  it('profileInitial handles null and undefined safely', async () => {
  const { component } = await setup();

  (component as any).username = null;
  expect(component.profileInitial).toBe('U');

  (component as any).username = undefined;
  expect(component.profileInitial).toBe('U');
});
it('document click HostListener clears menu and settings', async () => {
  const { component } = await setup();

  component.openMenuId = 'abc';
  component.settingsOpen = true;

  document.dispatchEvent(new Event('click'));

  expect(component.openMenuId).toBeNull();
  expect(component.settingsOpen).toBe(false);
});
});