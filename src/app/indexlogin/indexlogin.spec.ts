import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IndexLogin } from './indexlogin';

describe('IndexLogin (Vitest)', () => {
  let httpMock: HttpTestingController;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IndexLogin, FormsModule, CommonModule],
      providers: [provideRouter([]), provideHttpClientTesting()],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    sessionStorage.clear();
  });

  afterEach(() => {
    httpMock.verify();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  // =========================
  // BASIC
  // =========================

  it('should create', () => {
    const fixture = TestBed.createComponent(IndexLogin);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render signup link (routerLink="/signup")', () => {
    const fixture = TestBed.createComponent(IndexLogin);
    fixture.detectChanges();

    const a: HTMLAnchorElement | null =
      fixture.nativeElement.querySelector('a[routerLink="/signup"]');
    expect(a).toBeTruthy();
  });

  // =========================
  // TEMPLATE COVERAGE (HTML)
  // =========================

  it('should call goHome when back icon is clicked', () => {
    const fixture = TestBed.createComponent(IndexLogin);
    const comp = fixture.componentInstance;

    const spy = vi.spyOn(comp, 'goHome');

    fixture.detectChanges();

    const back = fixture.nativeElement.querySelector('.login__back-icon') as HTMLElement;
    back.click();

    expect(spy).toHaveBeenCalled();
  });

  it('should show/hide error message in DOM with *ngIf', async () => {
    const fixture = TestBed.createComponent(IndexLogin);
    const comp = fixture.componentInstance;

    comp.errorMsg = '';
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.login__error')).toBeNull();

    comp.errorMsg = 'Some error';

    await Promise.resolve(); // avoid NG0100
    fixture.detectChanges();

    const errEl = fixture.nativeElement.querySelector('.login__error') as HTMLElement;
    expect(errEl).toBeTruthy();
    expect(errEl.textContent).toContain('Some error');
  });

  it('should show eye.png when showPassword is false (else template)', async () => {
    const fixture = TestBed.createComponent(IndexLogin);
    const comp = fixture.componentInstance;

    comp.showPassword = false;

    await fixture.whenStable();
    fixture.detectChanges();

    const img = fixture.nativeElement.querySelector('.field__eye img') as HTMLImageElement;
    expect(img.getAttribute('src') || '').toContain('eye.png');
  });

  it('should render eyeClosed template explicitly (else branch execution)', async () => {
    const fixture = TestBed.createComponent(IndexLogin);
    const comp = fixture.componentInstance;

    comp.showPassword = false;

    await fixture.whenStable();
    fixture.detectChanges();

    const img = fixture.nativeElement.querySelector('.field__eye img') as HTMLImageElement;
    expect(img).toBeTruthy();
    expect(img.getAttribute('src') || '').toContain('eye.png');
  });

  it('should show visible.png when showPassword is true (*ngIf branch)', async () => {
    const fixture = TestBed.createComponent(IndexLogin);
    const comp = fixture.componentInstance;

    comp.showPassword = true;

    await fixture.whenStable();
    fixture.detectChanges();

    const img = fixture.nativeElement.querySelector('.field__eye img') as HTMLImageElement;
    expect(img.getAttribute('src') || '').toContain('visible.png');
  });

  it('should show "Login" text when loading is false', async () => {
    const fixture = TestBed.createComponent(IndexLogin);
    const comp = fixture.componentInstance;

    comp.loading = false;

    await fixture.whenStable();
    fixture.detectChanges();

    const btn = fixture.nativeElement.querySelector(
      'button[type="submit"]'
    ) as HTMLButtonElement;

    expect(btn.disabled).toBe(false);
    expect(btn.textContent || '').toContain('Login');
  });

  it('should show "Logging in..." text when loading is true', async () => {
    const fixture = TestBed.createComponent(IndexLogin);
    const comp = fixture.componentInstance;

    comp.loading = true;

    await fixture.whenStable();
    fixture.detectChanges();

    const btn = fixture.nativeElement.querySelector(
      'button[type="submit"]'
    ) as HTMLButtonElement;

    expect(btn.disabled).toBe(true);
    expect(btn.textContent || '').toContain('Logging in...');
  });

  it('should trigger login() on form submit (ngSubmit)', () => {
    const fixture = TestBed.createComponent(IndexLogin);
    const comp = fixture.componentInstance;

    const spy = vi.spyOn(comp, 'login');

    fixture.detectChanges();

    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(spy).toHaveBeenCalled();
  });

  it('togglePassword should flip showPassword + update input type in DOM', () => {
    const fixture = TestBed.createComponent(IndexLogin);
    const comp = fixture.componentInstance;
    fixture.detectChanges();

    const passInput = () =>
      fixture.nativeElement.querySelector('input[name="password"]') as HTMLInputElement;

    const eyeBtn = fixture.nativeElement.querySelector('.field__eye') as HTMLButtonElement;

    // initial
    expect(comp.showPassword).toBe(false);
    expect(passInput().type).toBe('password');

    eyeBtn.click();
    fixture.detectChanges();

    expect(comp.showPassword).toBe(true);
    expect(passInput().type).toBe('text');

    eyeBtn.click();
    fixture.detectChanges();

    expect(comp.showPassword).toBe(false);
    expect(passInput().type).toBe('password');
  });

  // =========================
  // TS LOGIC TESTS
  // =========================

  it('togglePassword should flip showPassword', () => {
    const fixture = TestBed.createComponent(IndexLogin);
    const comp = fixture.componentInstance;

    expect(comp.showPassword).toBe(false);
    comp.togglePassword();
    expect(comp.showPassword).toBe(true);
    comp.togglePassword();
    expect(comp.showPassword).toBe(false);
  });

  it('goHome should navigate to /', async () => {
    const fixture = TestBed.createComponent(IndexLogin);
    const comp = fixture.componentInstance;

    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true as any);

    comp.goHome();

    expect(navSpy).toHaveBeenCalledWith(['/']);
  });

  it('clearError should clear errorMsg only when there is one', () => {
    const fixture = TestBed.createComponent(IndexLogin);
    const comp = fixture.componentInstance;

    comp.errorMsg = '';
    comp.clearError();
    expect(comp.errorMsg).toBe('');

    comp.errorMsg = 'Some error';
    comp.clearError();
    expect(comp.errorMsg).toBe('');
  });

  it('login should block if loading is true (double submit guard)', () => {
    const fixture = TestBed.createComponent(IndexLogin);
    const comp = fixture.componentInstance;

    comp.loading = true;
    comp.email = 'a@a.com';
    comp.password = '123';

    comp.login();

    httpMock.expectNone('http://localhost:8080/api/auth/login');
  });

  it('login should show error if email or password missing', () => {
    const fixture = TestBed.createComponent(IndexLogin);
    const comp = fixture.componentInstance;

    comp.email = '';
    comp.password = '';
    comp.login();

    expect(comp.errorMsg).toBe('Email and password are required');
    httpMock.expectNone('http://localhost:8080/api/auth/login');
  });

  it('login success but missing userId should set error and NOT navigate', async () => {
    const fixture = TestBed.createComponent(IndexLogin);
    const comp = fixture.componentInstance;

    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true as any);

    comp.email = 'test@example.com';
    comp.password = 'secret';

    comp.login();

    const req = httpMock.expectOne('http://localhost:8080/api/auth/login');
    req.flush({ email: 'test@example.com' }); // no userId/id/_id

    await Promise.resolve();

    expect(comp.errorMsg).toBe('Login succeeded but userId was not returned by backend.');
    expect(navSpy).not.toHaveBeenCalled();
    expect(comp.loading).toBe(false);
  });

  it('login should accept res.id as userId fallback', async () => {
    const fixture = TestBed.createComponent(IndexLogin);
    const comp = fixture.componentInstance;

    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true as any);

    comp.email = 'test@example.com';
    comp.password = 'secret';

    comp.login();

    const req = httpMock.expectOne('http://localhost:8080/api/auth/login');
    req.flush({ id: 'id-1', email: 'test@example.com' });

    await Promise.resolve();

    expect(sessionStorage.getItem('userId')).toBe('id-1');
    expect(navSpy).toHaveBeenCalledWith(['/chatbox']);
  });

  it('login should accept res._id as userId fallback', async () => {
    const fixture = TestBed.createComponent(IndexLogin);
    const comp = fixture.componentInstance;

    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true as any);

    comp.email = 'test@example.com';
    comp.password = 'secret';

    comp.login();

    const req = httpMock.expectOne('http://localhost:8080/api/auth/login');
    req.flush({ _id: 'mongo-1', email: 'test@example.com' });

    await Promise.resolve();

    expect(sessionStorage.getItem('userId')).toBe('mongo-1');
    expect(navSpy).toHaveBeenCalledWith(['/chatbox']);
  });

  it('login error status 409 -> Invalid email or password', async () => {
    const fixture = TestBed.createComponent(IndexLogin);
    const comp = fixture.componentInstance;

    comp.email = 'test@example.com';
    comp.password = 'secret';

    comp.login();

    const req = httpMock.expectOne('http://localhost:8080/api/auth/login');
    req.flush({ message: 'conflict' }, { status: 409, statusText: 'Conflict' });

    await Promise.resolve();

    expect(comp.errorMsg).toBe('Invalid email or password');
    expect(comp.loading).toBe(false);
  });

  it('login error status 401 -> Invalid email or password', async () => {
    const fixture = TestBed.createComponent(IndexLogin);
    const comp = fixture.componentInstance;

    comp.email = 'test@example.com';
    comp.password = 'secret';

    comp.login();

    const req = httpMock.expectOne('http://localhost:8080/api/auth/login');
    req.flush(
      { message: 'unauthorized' },
      { status: 401, statusText: 'Unauthorized' }
    );

    await Promise.resolve();

    expect(comp.errorMsg).toBe('Invalid email or password');
    expect(comp.loading).toBe(false);
  });

  it('login other error -> uses err.error.message if present', async () => {
    const fixture = TestBed.createComponent(IndexLogin);
    const comp = fixture.componentInstance;

    comp.email = 'test@example.com';
    comp.password = 'secret';

    comp.login();

    const req = httpMock.expectOne('http://localhost:8080/api/auth/login');
    req.flush({ message: 'Backend down' }, { status: 500, statusText: 'Server Error' });

    await Promise.resolve();

    expect(comp.errorMsg).toBe('Backend down');
    expect(comp.loading).toBe(false);
  });

  it('login other error -> fallback message when no err.error.message', async () => {
    const fixture = TestBed.createComponent(IndexLogin);
    const comp = fixture.componentInstance;

    comp.email = 'test@example.com';
    comp.password = 'secret';

    comp.login();

    const req = httpMock.expectOne('http://localhost:8080/api/auth/login');
    req.flush('oops', { status: 500, statusText: 'Server Error' });

    await Promise.resolve();

    expect(comp.errorMsg).toBe('Login failed. Please try again.');
    expect(comp.loading).toBe(false);
  });

  it('login should clear previous errorMsg before validating/sending', () => {
    const fixture = TestBed.createComponent(IndexLogin);
    const comp = fixture.componentInstance;

    comp.errorMsg = 'Old error';
    comp.email = '';
    comp.password = '';

    comp.login();

    expect(comp.errorMsg).toBe('Email and password are required');
  });
});