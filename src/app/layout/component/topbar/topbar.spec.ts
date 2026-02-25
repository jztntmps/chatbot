import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { UiModalService } from '../../../shared/ui-modal/ui-modal.service';

const docMock = {
  internal: {
    pageSize: {
      getWidth: vi.fn(() => 200),
      getHeight: vi.fn(() => 120),
    },
  },
  setFont: vi.fn(),
  setFontSize: vi.fn(),
  text: vi.fn(),
  setDrawColor: vi.fn(),
  line: vi.fn(),
  splitTextToSize: vi.fn((txt: string) => Array(20).fill(txt)),
  addPage: vi.fn(),
  save: vi.fn(),
};

function JsPDF(this: any, _opts?: any) {
  return docMock;
}

vi.mock('jspdf', () => {
  return {
    __esModule: true,
    jsPDF: JsPDF,
    default: { jsPDF: JsPDF },
  };
});

import { Topbar } from './topbar';

type MockUiModal = {
  confirm: ReturnType<typeof vi.fn>;
  notify: ReturnType<typeof vi.fn>;
};

const makeUiModal = (): MockUiModal => ({
  confirm: vi.fn(),
  notify: vi.fn(),
});

async function setup(opts?: { confirmResult?: boolean }): Promise<{
  fixture: ComponentFixture<Topbar>;
  component: Topbar;
  uiModal: MockUiModal;
}> {
  const uiModal = makeUiModal();
  uiModal.notify.mockResolvedValue(undefined);
  if (typeof opts?.confirmResult === 'boolean')
    uiModal.confirm.mockResolvedValue(opts.confirmResult);

  TestBed.resetTestingModule();

  await TestBed.configureTestingModule({
    imports: [Topbar],
    providers: [{ provide: UiModalService, useValue: uiModal }],
    schemas: [NO_ERRORS_SCHEMA],
  }).compileComponents();

  const fixture: ComponentFixture<Topbar> = TestBed.createComponent(Topbar);
  const component: Topbar = fixture.componentInstance;

  fixture.detectChanges();

  return { fixture, component, uiModal };
}

describe('Topbar (Vitest) - full coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('should create', async () => {
    const { component } = await setup();
    expect(component).toBeTruthy();
  });

  it('updateDate sets today', async () => {
    const { component } = await setup();
    (component as any).today = '';
    (component as any).updateDate();
    expect(component.today).toBeTruthy();
  });

  it('ngOnInit sets today and starts timer; callback runs via fake timers; ngOnDestroy clears timer', async () => {
    const { component } = await setup();

    vi.useFakeTimers();

    const updateSpy = vi.spyOn(component as any, 'updateDate');
    const setSpy = vi.spyOn(window, 'setInterval');
    const clearSpy = vi.spyOn(window, 'clearInterval');

    component.ngOnInit();

    expect(setSpy).toHaveBeenCalled();
    expect(component.today).toBeTruthy();

    vi.advanceTimersByTime(60_000);
    expect(updateSpy).toHaveBeenCalled();

    component.ngOnDestroy();
    expect(clearSpy).toHaveBeenCalled();

    updateSpy.mockRestore();
    setSpy.mockRestore();
    clearSpy.mockRestore();
  });

  it('ngOnDestroy with no timer should not throw', async () => {
    const { component } = await setup();
    (component as any).timer = undefined;
    expect(() => component.ngOnDestroy()).not.toThrow();
  });

  it('onToggleSidebar emits toggleSidebar', async () => {
    const { component } = await setup();
    const spy = vi.fn();
    component.toggleSidebar.subscribe(spy);

    component.onToggleSidebar();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('toggleMenu stops propagation and toggles menuOpen', async () => {
    const { component } = await setup();
    const ev = { stopPropagation: vi.fn() } as any;

    component.menuOpen = false;
    component.toggleMenu(ev);
    expect(ev.stopPropagation).toHaveBeenCalledTimes(1);
    expect(component.menuOpen).toBe(true);

    component.toggleMenu(ev);
    expect(component.menuOpen).toBe(false);
  });

  it('closeMenu sets menuOpen false', async () => {
    const { component } = await setup();
    component.menuOpen = true;
    component.closeMenu();
    expect(component.menuOpen).toBe(false);
  });

  it('onExport emits exportChat and closes menu', async () => {
    const { component } = await setup();
    const spy = vi.fn();
    component.exportChat.subscribe(spy);

    component.menuOpen = true;
    component.onExport();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(component.menuOpen).toBe(false);
  });

  it('onArchive: no currentConversationId -> closes menu and notify neutral', async () => {
    const { component, uiModal } = await setup();

    component.menuOpen = true;
    component.currentConversationId = '   ';

    await component.onArchive();

    expect(component.menuOpen).toBe(false);
    expect(uiModal.notify).toHaveBeenCalledTimes(1);

    const arg = uiModal.notify.mock.calls[0][0];
    expect(arg.title).toBe('No chat selected');
    expect(arg.variant).toBe('neutral');
  });

  it('onArchive: confirm=false -> does not emit, no success notify', async () => {
    const { component, uiModal } = await setup({ confirmResult: false });

    const emitSpy = vi.fn();
    component.archiveChatId.subscribe(emitSpy);

    component.currentConversationId = ' cid1 ';
    component.menuOpen = true;

    await component.onArchive();

    expect(component.menuOpen).toBe(false);
    expect(uiModal.confirm).toHaveBeenCalledTimes(1);
    expect(emitSpy).not.toHaveBeenCalled();
    expect(uiModal.notify).toHaveBeenCalledTimes(0);
  });

  it('onArchive: confirm=true -> emits archiveChatId and shows success notify', async () => {
    const { component, uiModal } = await setup({ confirmResult: true });

    const emitSpy = vi.fn();
    component.archiveChatId.subscribe(emitSpy);

    component.currentConversationId = ' cid1 ';
    component.menuOpen = true;

    await component.onArchive();

    expect(uiModal.confirm).toHaveBeenCalledTimes(1);
    expect(emitSpy).toHaveBeenCalledWith('cid1');

    expect(uiModal.notify).toHaveBeenCalledTimes(1);
    const arg = uiModal.notify.mock.calls[0][0];
    expect(arg.title).toBe('Archived');
    expect(arg.variant).toBe('success');
  });

  it('onDelete: no currentConversationId -> closes menu and notify neutral', async () => {
    const { component, uiModal } = await setup();

    component.menuOpen = true;
    component.currentConversationId = null;

    await component.onDelete();

    expect(component.menuOpen).toBe(false);
    expect(uiModal.notify).toHaveBeenCalledTimes(1);

    const arg = uiModal.notify.mock.calls[0][0];
    expect(arg.title).toBe('No chat selected');
    expect(arg.variant).toBe('neutral');
  });

  it('onDelete: confirm=false -> does not emit, no success notify', async () => {
    const { component, uiModal } = await setup({ confirmResult: false });

    const emitSpy = vi.fn();
    component.deleteChatId.subscribe(emitSpy);

    component.currentConversationId = ' cid1 ';
    component.menuOpen = true;

    await component.onDelete();

    expect(component.menuOpen).toBe(false);
    expect(uiModal.confirm).toHaveBeenCalledTimes(1);
    expect(emitSpy).not.toHaveBeenCalled();
    expect(uiModal.notify).toHaveBeenCalledTimes(0);
  });

  it('onDelete: confirm=true -> emits deleteChatId and shows success notify', async () => {
    const { component, uiModal } = await setup({ confirmResult: true });

    const emitSpy = vi.fn();
    component.deleteChatId.subscribe(emitSpy);

    component.currentConversationId = ' cid1 ';
    component.menuOpen = true;

    await component.onDelete();

    expect(uiModal.confirm).toHaveBeenCalledTimes(1);
    expect(emitSpy).toHaveBeenCalledWith('cid1');

    expect(uiModal.notify).toHaveBeenCalledTimes(1);
    const arg = uiModal.notify.mock.calls[0][0];
    expect(arg.title).toBe('Deleted');
    expect(arg.variant).toBe('success');
  });

  it('onDocClick: menuOpen=false -> returns early', async () => {
    const { component } = await setup();

    const containsSpy = vi.spyOn((component as any).el.nativeElement, 'contains');

    component.menuOpen = false;
    component.onDocClick(new MouseEvent('click'));

    expect(containsSpy).not.toHaveBeenCalled();
  });

  it('onDocClick: clicked inside -> does not close', async () => {
    const { component } = await setup();

    const containsSpy = vi
      .spyOn((component as any).el.nativeElement, 'contains')
      .mockReturnValue(true);

    component.menuOpen = true;
    component.onDocClick(new MouseEvent('click'));

    expect(containsSpy).toHaveBeenCalled();
    expect(component.menuOpen).toBe(true);
  });

  it('onDocClick: clicked outside -> closes menu', async () => {
    const { component } = await setup();

    const containsSpy = vi
      .spyOn((component as any).el.nativeElement, 'contains')
      .mockReturnValue(false);

    component.menuOpen = true;
    component.onDocClick(new MouseEvent('click'));

    expect(containsSpy).toHaveBeenCalled();
    expect(component.menuOpen).toBe(false);
  });

  it('onEsc closes menu', async () => {
    const { component } = await setup();
    component.menuOpen = true;
    component.onEsc();
    expect(component.menuOpen).toBe(false);
  });

  it('downloadConversationAsPdf: no messages -> alerts', async () => {
    const { component } = await setup();

    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    component.messages = [];

    (component as any).downloadConversationAsPdf();

    expect(alertSpy).toHaveBeenCalledWith('No conversation to export yet.');
    alertSpy.mockRestore();
  });

  it('downloadConversationAsPdf: builds pdf and saves (covers loop + pagination)', async () => {
    const { component } = await setup();

    docMock.setFont.mockClear();
    docMock.setFontSize.mockClear();
    docMock.text.mockClear();
    docMock.setDrawColor.mockClear();
    docMock.line.mockClear();
    docMock.splitTextToSize.mockClear();
    docMock.addPage.mockClear();
    docMock.save.mockClear();

    docMock.internal.pageSize.getHeight.mockReturnValue(90);
    docMock.splitTextToSize.mockImplementation((txt: string) => Array(50).fill(txt));

    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(123);

    component.messages = [
      { role: 'user', content: 'Hello there' },
      { role: 'ai', text: 'This is a long reply that should paginate.' },
    ];

    (component as any).downloadConversationAsPdf();

    expect(docMock.text).toHaveBeenCalled();
    expect(docMock.splitTextToSize).toHaveBeenCalled();
    expect(docMock.addPage).toHaveBeenCalled();
    expect(docMock.save).toHaveBeenCalledTimes(1);

    nowSpy.mockRestore();
  });

  it('downloadConversationAsPdf: skips empty content messages', async () => {
    const { component } = await setup();

    docMock.text.mockClear();
    docMock.save.mockClear();
    docMock.splitTextToSize.mockClear();
    docMock.addPage.mockClear();

    docMock.internal.pageSize.getHeight.mockReturnValue(90);
    docMock.splitTextToSize.mockImplementation((txt: string) => Array(50).fill(txt));

    component.messages = [
      { role: 'user', content: '   ' },
      { role: 'assistant', message: '' },
      { role: 'bot', text: 'OK' },
    ];

    (component as any).downloadConversationAsPdf();

    expect(docMock.save).toHaveBeenCalledTimes(1);
    expect(docMock.text).toHaveBeenCalled();
    expect(docMock.splitTextToSize).toHaveBeenCalled();
  });

  it('downloadConversationAsPdf: non-user role uses Assistant label branch', async () => {
    const { component } = await setup();

    docMock.addPage.mockClear();
    docMock.save.mockClear();
    docMock.text.mockClear();

    docMock.internal.pageSize.getHeight.mockReturnValue(1000);
    docMock.splitTextToSize.mockImplementation((txt: string) => [txt]);

    component.messages = [
      { role: 'assistant', content: 'Assistant message' },
      { role: 'bot', text: 'Bot message' },
    ];

    (component as any).downloadConversationAsPdf();

    expect(docMock.addPage).not.toHaveBeenCalled();
    expect(docMock.save).toHaveBeenCalledTimes(1);
    expect(docMock.text).toHaveBeenCalled();
  });

  it('downloadConversationAsPdf: message field path is used', async () => {
    const { component } = await setup();

    docMock.addPage.mockClear();
    docMock.save.mockClear();
    docMock.splitTextToSize.mockClear();

    docMock.internal.pageSize.getHeight.mockReturnValue(2000);
    docMock.splitTextToSize.mockImplementation((txt: string) => [txt]);

    component.messages = [{ role: 'assistant', message: 'From message field' }];

    (component as any).downloadConversationAsPdf();

    expect(docMock.addPage).not.toHaveBeenCalled();
    expect(docMock.splitTextToSize).toHaveBeenCalled();
    expect(docMock.save).toHaveBeenCalledTimes(1);
  });

  it('downloadConversationAsPdf: no page break path (y never exceeds)', async () => {
    const { component } = await setup();

    docMock.addPage.mockClear();
    docMock.save.mockClear();

    docMock.internal.pageSize.getHeight.mockReturnValue(2000);
    docMock.splitTextToSize.mockImplementation((txt: string) => [txt]);

    component.messages = [{ role: 'user', content: 'Short' }];

    (component as any).downloadConversationAsPdf();

    expect(docMock.addPage).not.toHaveBeenCalled();
    expect(docMock.save).toHaveBeenCalledTimes(1);
  });
    it('downloadConversationAsPdf: messages undefined -> alerts (covers !this.messages branch)', async () => {
    const { component } = await setup();

    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    (component as any).messages = undefined;

    (component as any).downloadConversationAsPdf();

    expect(alertSpy).toHaveBeenCalledWith('No conversation to export yet.');
    alertSpy.mockRestore();
  });

  it('downloadConversationAsPdf: message with no content/message/text is skipped (covers ?? "" fallback branch)', async () => {
    const { component } = await setup();

    docMock.addPage.mockClear();
    docMock.save.mockClear();
    docMock.text.mockClear();
    docMock.splitTextToSize.mockClear();

    docMock.internal.pageSize.getHeight.mockReturnValue(2000);
    docMock.splitTextToSize.mockImplementation((txt: string) => [txt]);

    component.messages = [
      { role: 'bot' } as any, // ✅ forces (m.content ?? m.message ?? m.text ?? '') -> ''
      { role: 'user', content: 'Has content' },
    ];

    (component as any).downloadConversationAsPdf();

    expect(docMock.save).toHaveBeenCalledTimes(1);
    expect(docMock.text).toHaveBeenCalled(); // should still render the valid message
  });

  it('onArchive: currentConversationId undefined -> closes menu and notify neutral', async () => {
  const { component, uiModal } = await setup();

  component.menuOpen = true;
  (component as any).currentConversationId = undefined;

  await component.onArchive();

  expect(component.menuOpen).toBe(false);
  expect(uiModal.notify).toHaveBeenCalledTimes(1);

  const arg = uiModal.notify.mock.calls[0][0];
  expect(arg.title).toBe('No chat selected');
  expect(arg.variant).toBe('neutral');
});

it('onDelete: currentConversationId blank string -> closes menu and notify neutral', async () => {
  const { component, uiModal } = await setup();

  component.menuOpen = true;
  component.currentConversationId = '   ';

  await component.onDelete();

  expect(component.menuOpen).toBe(false);
  expect(uiModal.notify).toHaveBeenCalledTimes(1);

  const arg = uiModal.notify.mock.calls[0][0];
  expect(arg.title).toBe('No chat selected');
  expect(arg.variant).toBe('neutral');
});

it('calls private downloadConversationAsPdf directly (function coverage)', async () => {
  const { component } = await setup();
  component.messages = [{ role: 'user', content: 'Hello' }];

  (component as any).downloadConversationAsPdf();

  expect(docMock.save).toHaveBeenCalled();
});

it('direct new Topbar() covers class declaration + field initializers (fixes red Topbar line)', async () => {
  const uiModal = makeUiModal();
  uiModal.notify.mockResolvedValue(undefined);
  uiModal.confirm.mockResolvedValue(true);

  const el = {
    nativeElement: { contains: vi.fn(() => true) },
  } as any;

  const tb = new Topbar(el, uiModal as any);

  // touch field initializers so coverage marks them as executed
  expect(tb).toBeInstanceOf(Topbar);
  expect(tb.isLoggedIn).toBe(false);
  expect(Array.isArray(tb.messages)).toBe(true);
  expect(tb.currentConversationId).toBe(null);
  expect(tb.menuOpen).toBe(false);

  // touch outputs (these are created in-field)
  expect(tb.login).toBeTruthy();
  expect(tb.signup).toBeTruthy();
  expect(tb.newChat).toBeTruthy();
  expect(tb.toggleSidebar).toBeTruthy();
  expect(tb.archiveChatId).toBeTruthy();
  expect(tb.deleteChatId).toBeTruthy();
  expect(tb.exportChat).toBeTruthy();
});

it('HostListener: document click closes menu (real event)', async () => {
  const { component, fixture } = await setup();

  component.menuOpen = true;
  fixture.detectChanges();

  // click outside component => should close
  document.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  expect(component.menuOpen).toBe(false);
});

it('HostListener: Escape key closes menu (real event)', async () => {
  const { component, fixture } = await setup();

  component.menuOpen = true;
  fixture.detectChanges();

  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  expect(component.menuOpen).toBe(false);
});

});