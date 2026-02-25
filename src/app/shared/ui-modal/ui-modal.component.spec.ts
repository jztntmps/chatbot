import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CommonModule } from '@angular/common';

import { UiModalComponent } from './ui-modal.component';
import { UiModalService } from './ui-modal.service';

describe('UiModalComponent (template coverage)', () => {
  let fixture: ComponentFixture<UiModalComponent>;
  let component: UiModalComponent;
  let service: UiModalService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CommonModule, UiModalComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(UiModalComponent);
    component = fixture.componentInstance;
    service = TestBed.inject(UiModalService);

    fixture.detectChanges();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    service.close();
  });

  function el<T extends Element = Element>(selector: string): T {
    const found = fixture.nativeElement.querySelector(selector);
    if (!found) throw new Error(`Element not found: ${selector}`);
    return found as T;
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should not render modal when closed', () => {
    service.close();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.m')).toBeNull();
  });

  it('should render confirm modal and resolve true via confirm button', async () => {
    const p = service.confirm({
      title: 'Title',
      message: 'Message',
      variant: 'neutral',
      icon: 'question',
      cancelText: 'Cancel',
      confirmText: 'OK',
      showCancel: true,
    });

    fixture.detectChanges();

    expect(el('.m__title').textContent).toContain('Title');
    expect(el('.m__msg').textContent).toContain('Message');

    // cancel visible
    expect(fixture.nativeElement.querySelector('.btn--cancel')).toBeTruthy();

    // click confirm
    el<HTMLButtonElement>('.m__actions .btn:not(.btn--cancel)').click();
    fixture.detectChanges();

    await expect(p).resolves.toBe(true);
    expect(fixture.nativeElement.querySelector('.m')).toBeNull();
  });

  it('should resolve false when clicking backdrop', async () => {
    const p = service.confirm({ title: 'T', message: 'M' });
    fixture.detectChanges();

    el<HTMLDivElement>('.m__backdrop').click();
    fixture.detectChanges();

    await expect(p).resolves.toBe(false);
    expect(fixture.nativeElement.querySelector('.m')).toBeNull();
  });

  it('should resolve false when clicking close button', async () => {
    const p = service.confirm({ title: 'T', message: 'M' });
    fixture.detectChanges();

    el<HTMLButtonElement>('.m__close').click();
    fixture.detectChanges();

    await expect(p).resolves.toBe(false);
    expect(fixture.nativeElement.querySelector('.m')).toBeNull();
  });

  it('should hide cancel button when showCancel is false', () => {
    service.confirm({
      title: 'No Cancel',
      message: 'Only OK',
      showCancel: false,
    });

    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.btn--cancel')).toBeNull();
  });

  it('should apply danger/success icon class based on variant', () => {
    // danger
    service.confirm({
      title: 'Danger',
      message: 'X',
      variant: 'danger',
      icon: 'warning',
    });
    fixture.detectChanges();
    expect(el('.m__icon').classList.contains('m__icon--danger')).toBe(true);

    // close
    service.close();
    fixture.detectChanges();

    // success
    service.confirm({
      title: 'Success',
      message: 'Y',
      variant: 'success',
      icon: 'success',
    });
    fixture.detectChanges();
    expect(el('.m__icon').classList.contains('m__icon--success')).toBe(true);
  });

  it('should render each icon type (warning/question/success) without errors', () => {
    // warning
    service.confirm({ title: 'W', message: 'W', icon: 'warning' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('svg')).toBeTruthy();

    service.close();
    fixture.detectChanges();

    // question
    service.confirm({ title: 'Q', message: 'Q', icon: 'question' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('svg')).toBeTruthy();

    service.close();
    fixture.detectChanges();

    // success
    service.confirm({ title: 'S', message: 'S', icon: 'success' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('svg')).toBeTruthy();
  });

  it('notify should render with no cancel and resolve when confirm clicked', async () => {
    const p = service.notify({
      title: 'Notify',
      message: 'Hello',
      variant: 'success',
      icon: 'success',
      confirmText: 'OK',
      autoCloseMs: 0,
    });

    fixture.detectChanges();

    // no cancel button in notify mode
    expect(fixture.nativeElement.querySelector('.btn--cancel')).toBeNull();

    // click confirm
    el<HTMLButtonElement>('.m__actions .btn').click();
    fixture.detectChanges();

    await expect(p).resolves.toBeUndefined();
    expect(fixture.nativeElement.querySelector('.m')).toBeNull();
  });

  it('onEsc should call modal._resolve(false)', () => {
    const spy = vi.spyOn(service, '_resolve');
    component.onEsc();
    expect(spy).toHaveBeenCalledWith(false);
  });

  it('HostListener escape should trigger onEsc', () => {
    const spy = vi.spyOn(component, 'onEsc');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(spy).toHaveBeenCalled();
  });
});