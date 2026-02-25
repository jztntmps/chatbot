import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  Signup,
  allowedEmailValidator,
  matchPasswords,
  strongPasswordValidator,
} from './signup';

import { FormControl, FormGroup } from '@angular/forms';

describe('Signup - target 100% coverage (TS + HTML)', () => {
  let component: Signup;
  let fixture: ComponentFixture<Signup>;
  let httpMock: HttpTestingController;
  let router: Router;

  const API = 'http://localhost:8080/api/auth/signup';

  function qs<T extends Element = Element>(sel: string): T | null {
    return fixture.nativeElement.querySelector(sel) as T | null;
  }

  function qsa<T extends Element = Element>(sel: string): T[] {
    return Array.from(fixture.nativeElement.querySelectorAll(sel)) as T[];
  }

  async function stabilize() {
    // avoids NG0100 in some Angular dev-mode checks
    await Promise.resolve();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function fillValidForm() {
    component.form.setValue({
      username: 'tester',
      email: 'test@email.com', // allowed (.com)
      password: 'Strong1!',
      confirmPassword: 'Strong1!',
    });
  }

  // ✅ Spy the REAL DOM focus() created by @ViewChild
  function spyFocus() {
    fixture.detectChanges(); // ensure ViewChild is resolved

    const userFocusSpy = vi
      .spyOn(component.usernameInput.nativeElement, 'focus')
      .mockImplementation(() => {});

    const emailFocusSpy = vi
      .spyOn(component.emailInput.nativeElement, 'focus')
      .mockImplementation(() => {});

    return { userFocusSpy, emailFocusSpy };
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Signup],
      providers: [provideRouter([]), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(Signup);
    component = fixture.componentInstance;

    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);

    sessionStorage.clear();
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // =========================
  // TEMPLATE: back button click
  // =========================
  it('should call goHome when clicking back button', () => {
    const spy = vi.spyOn(component, 'goHome');
    fixture.detectChanges();

    const backBtn = qs<HTMLButtonElement>('.signup__back');
    expect(backBtn).toBeTruthy();

    backBtn!.click();
    expect(spy).toHaveBeenCalled();
  });

  // =========================
  // showErr branches (TS)
  // =========================
  it('showErr should return false when ctrl is null', () => {
    expect(component.showErr(null)).toBe(false);
  });

  it('showErr should return true when invalid and touched', () => {
    const ctrl = component.f.username;
    ctrl.setValue(''); // required
    ctrl.markAsTouched();
    expect(component.showErr(ctrl)).toBe(true);
  });

  // =========================
  // trimControl branches (TS)
  // =========================
  it('trimControl should do nothing when form.get returns null', () => {
    const spy = vi.spyOn(component.form, 'get').mockReturnValueOnce(null as any);
    (component as any).trimControl('username');
    expect(spy).toHaveBeenCalled();
  });

  it('onUsernameInput should trim and clear backend error', async () => {
    component.f.username.setValue('   test   ');
    component.f.username.setErrors({ backendTaken: true });
    component.usernameError = 'Taken';

    component.onUsernameInput();
    await stabilize();

    expect(component.f.username.value).toBe('test');
    expect(component.usernameError).toBe('');
    expect(component.f.username.errors).toBeNull();
  });

  it('onEmailInput should trim and clear backend error', async () => {
    component.f.email.setValue('   test@email.com   ');
    component.f.email.setErrors({ backendTaken: true });
    component.emailError = 'Taken';

    component.onEmailInput();
    await stabilize();

    expect(component.f.email.value).toBe('test@email.com');
    expect(component.emailError).toBe('');
    expect(component.f.email.errors).toBeNull();
  });

  // =========================
  // clear backend error branches (keep other errors)
  // =========================
  it('clearUsernameBackendError should remove backendTaken but keep other errors', () => {
    component.f.username.setErrors({
      backendTaken: true,
      minlength: { requiredLength: 3, actualLength: 1 },
    } as any);
    component.usernameError = 'Taken';
    component.generalError = 'General';

    (component as any).clearUsernameBackendError();

    expect(component.usernameError).toBe('');
    expect(component.generalError).toBe('');
    expect(component.f.username.errors?.['backendTaken']).toBeUndefined();
    expect(component.f.username.errors?.['minlength']).toBeTruthy();
  });

  it('clearEmailBackendError should remove backendTaken but keep other errors', () => {
    component.f.email.setErrors({ backendTaken: true, emailFormat: true } as any);
    component.emailError = 'Taken';
    component.generalError = 'General';

    (component as any).clearEmailBackendError();

    expect(component.emailError).toBe('');
    expect(component.generalError).toBe('');
    expect(component.f.email.errors?.['backendTaken']).toBeUndefined();
    expect(component.f.email.errors?.['emailFormat']).toBeTruthy();
  });

  it('clearUsernameBackendError should safely return if form.get is null', () => {
    const spy = vi.spyOn(component.form, 'get').mockReturnValueOnce(null as any);
    (component as any).clearUsernameBackendError();
    expect(spy).toHaveBeenCalled();
  });

  it('clearEmailBackendError should safely return if form.get is null', () => {
    const spy = vi.spyOn(component.form, 'get').mockReturnValueOnce(null as any);
    (component as any).clearEmailBackendError();
    expect(spy).toHaveBeenCalled();
  });

  // =========================
  // Validators branches (TS)
  // =========================
  it('matchPasswords should NOT set mismatch error if one field is missing', () => {
    component.f.password.setValue('Strong1!');
    component.f.confirmPassword.setValue('');
    expect(component.form.errors).toBeNull();
  });

  it('allowedEmailValidator should set emailFormat for invalid format', () => {
    component.f.email.setValue('not-an-email');
    expect(component.f.email.errors?.['emailFormat']).toBe(true);
  });

  it('strongPasswordValidator should fail when missing requirements', () => {
    component.f.password.setValue('abc'); // weak
    expect(component.f.password.errors?.['strongPassword']).toBeTruthy();
  });

  // =========================
  // TEMPLATE: username error branches
  // =========================
  it('template should show username required error', async () => {
    component.f.username.setValue('');
    component.f.username.markAsTouched();
    component.f.username.updateValueAndValidity();
    await stabilize();

    const err = qsa<HTMLElement>('.err')[0];
    expect(err?.textContent || '').toContain('Username is required.');
  });

  it('template should show username minlength error', async () => {
    component.f.username.setValue('ab'); // minlength 3
    component.f.username.markAsTouched();
    component.f.username.updateValueAndValidity();
    await stabilize();

    const err = qsa<HTMLElement>('.err')[0];
    expect(err?.textContent || '').toContain('at least 3 characters');
  });

  it('template should show username backendTaken message (with usernameError fallback)', async () => {
    component.f.username.setValue('tester');
    component.f.username.setErrors({ backendTaken: true });
    component.f.username.markAsTouched();
    component.usernameError = ''; // force fallback text
    await stabilize();

    const err = qsa<HTMLElement>('.err')[0];
    expect(err?.textContent || '').toContain('Username already exists.');
  });

  it('template should show username backendTaken message (with backend message)', async () => {
    component.f.username.setValue('tester');
    component.f.username.setErrors({ backendTaken: true });
    component.f.username.markAsTouched();
    component.usernameError = 'Username taken';
    await stabilize();

    const err = qsa<HTMLElement>('.err')[0];
    expect(err?.textContent || '').toContain('Username taken');
  });

  // =========================
  // TEMPLATE: email error branches
  // =========================
  it('template should show email required error', async () => {
    component.f.email.setValue('');
    component.f.email.markAsTouched();
    component.f.email.updateValueAndValidity();
    await stabilize();

    const errs = qsa<HTMLElement>('.err');
    expect(errs.some(e => (e.textContent || '').includes('Email is required.'))).toBe(true);
  });

  it('template should show email format error', async () => {
    component.f.email.setValue('invalid-email');
    component.f.email.markAsTouched();
    component.f.email.updateValueAndValidity();
    await stabilize();

    const errs = qsa<HTMLElement>('.err');
    expect(errs.some(e => (e.textContent || '').includes('Please enter a valid email'))).toBe(true);
  });

  it('template should show email domain not allowed error', async () => {
    component.f.email.setValue('a@b.xyz'); // valid format but disallowed TLD
    component.f.email.markAsTouched();
    component.f.email.updateValueAndValidity();
    await stabilize();

    const errs = qsa<HTMLElement>('.err');
    expect(errs.some(e => (e.textContent || '').includes('Allowed domains'))).toBe(true);
  });

  it('template should show email backendTaken message (with emailError fallback)', async () => {
    component.f.email.setValue('test@email.com');
    component.f.email.setErrors({ backendTaken: true });
    component.f.email.markAsTouched();
    component.emailError = ''; // fallback text
    await stabilize();

    const errs = qsa<HTMLElement>('.err');
    expect(errs.some(e => (e.textContent || '').includes('Email already exists.'))).toBe(true);
  });

  it('template should show email backendTaken message (with backend message)', async () => {
    component.f.email.setValue('test@email.com');
    component.f.email.setErrors({ backendTaken: true });
    component.f.email.markAsTouched();
    component.emailError = 'Email taken';
    await stabilize();

    const errs = qsa<HTMLElement>('.err');
    expect(errs.some(e => (e.textContent || '').includes('Email taken'))).toBe(true);
  });

  // =========================
  // TEMPLATE: password rules + weak password error
  // =========================
  it('template should show password rules when password touched/dirty', async () => {
    component.f.password.setValue('abc'); // dirty
    component.f.password.markAsTouched();
    component.f.password.updateValueAndValidity();
    await stabilize();

    const rules = qs<HTMLElement>('.rules');
    expect(rules).toBeTruthy();
    expect(rules!.textContent || '').toContain('Minimum 6 characters');
  });

  it('template should show password not strong enough error when invalid and touched', async () => {
    component.f.password.setValue('abc'); // weak => invalid
    component.f.password.markAsTouched();
    component.f.password.updateValueAndValidity();
    await stabilize();

    const errs = qsa<HTMLElement>('.err');
    expect(errs.some(e => (e.textContent || '').includes('Password is not strong enough'))).toBe(true);
  });

  // =========================
  // TEMPLATE: password mismatch
  // =========================
  it('template should show password mismatch when confirm touched and mismatch', async () => {
    component.f.password.setValue('Strong1!');
    component.f.confirmPassword.setValue('Strong2!');
    component.f.confirmPassword.markAsTouched();
    component.form.updateValueAndValidity();
    await stabilize();

    const errs = qsa<HTMLElement>('.err');
    expect(errs.some(e => (e.textContent || '').includes('Passwords do not match'))).toBe(true);
  });

  // =========================
  // TEMPLATE: submit button disabled + text branches
  // =========================
  it('template submit button should be disabled when form invalid', async () => {
    component.form.reset();
    component.submitting = false;
    await stabilize();

    const btn = qs<HTMLButtonElement>('button[type="submit"]');
    expect(btn).toBeTruthy();
    expect(btn!.disabled).toBe(true);
    expect(btn!.textContent || '').toContain('Sign Up');
  });

  it('template submit button should show "Signing up..." when submitting true', async () => {
    fillValidForm();
    component.submitting = true;
    await stabilize();

    const btn = qs<HTMLButtonElement>('button[type="submit"]');
    expect(btn).toBeTruthy();
    expect(btn!.disabled).toBe(true); // (form.invalid || submitting)
    expect(btn!.textContent || '').toContain('Signing up...');
  });

  it('template submit button should show "Sign Up" when submitting false and valid form', async () => {
    fillValidForm();
    component.submitting = false;
    await stabilize();

    const btn = qs<HTMLButtonElement>('button[type="submit"]');
    expect(btn).toBeTruthy();
    expect(btn!.disabled).toBe(false);
    expect(btn!.textContent || '').toContain('Sign Up');
  });

  // ✅ FIXED: avoid NG0100 by setting before first detectChanges
  it('template should show general server error block when generalError exists', () => {
    const localFixture = TestBed.createComponent(Signup);
    const localComp = localFixture.componentInstance;

    localComp.generalError = 'Server says no';
    localFixture.detectChanges();

    const serverErr = localFixture.nativeElement.querySelector('.err--server') as HTMLElement;
    expect(serverErr).toBeTruthy();
    expect(serverErr.textContent || '').toContain('Server says no');
  });

  // =========================
  // focusFirstInvalid branches
  // =========================
  it('onSubmit invalid should focus username first', () => {
    const { userFocusSpy, emailFocusSpy } = spyFocus();

    component.f.username.setValue(''); // invalid
    component.f.email.setValue('test@email.com');
    component.f.password.setValue('Strong1!');
    component.f.confirmPassword.setValue('Strong1!');

    component.onSubmit();

    expect(userFocusSpy).toHaveBeenCalled();
    expect(emailFocusSpy).not.toHaveBeenCalled();
    httpMock.expectNone(API);
  });

  it('onSubmit invalid should focus email when username is valid', () => {
    const { userFocusSpy, emailFocusSpy } = spyFocus();

    component.f.username.setValue('tester'); // valid
    component.f.email.setValue('a@b.xyz'); // invalid domain
    component.f.password.setValue('Strong1!');
    component.f.confirmPassword.setValue('Strong1!');

    component.onSubmit();

    expect(emailFocusSpy).toHaveBeenCalled();
    expect(userFocusSpy).not.toHaveBeenCalled();
    httpMock.expectNone(API);
  });

  // =========================
  // goHome
  // =========================
  it('goHome should navigate to /', () => {
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true as any);
    component.goHome();
    expect(navSpy).toHaveBeenCalledWith(['/']);
  });

  // =========================
  // success branches
  // =========================
  it('signup success should set session + navigate (userId) and hit complete()', async () => {
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true as any);
    const detectSpy = vi.spyOn((component as any).cdr, 'detectChanges');

    fillValidForm();
    component.onSubmit();

    const req = httpMock.expectOne(API);
    req.flush({ userId: '123', email: 'test@email.com' });

    await Promise.resolve();

    expect(sessionStorage.getItem('isLoggedIn')).toBe('true');
    expect(sessionStorage.getItem('userEmail')).toBe('test@email.com');
    expect(sessionStorage.getItem('userId')).toBe('123');
    expect(navSpy).toHaveBeenCalledWith(['/chatbox']);
    expect(detectSpy).toHaveBeenCalled();
  });

  it('signup success should accept id fallback', async () => {
    fillValidForm();
    component.onSubmit();

    const req = httpMock.expectOne(API);
    req.flush({ id: 'id-123', email: 'test@email.com' });

    await Promise.resolve();

    expect(sessionStorage.getItem('userId')).toBe('id-123');
  });

  it('signup success should accept _id fallback', async () => {
    fillValidForm();
    component.onSubmit();

    const req = httpMock.expectOne(API);
    req.flush({ _id: 'mongo-123', email: 'test@email.com' });

    await Promise.resolve();

    expect(sessionStorage.getItem('userId')).toBe('mongo-123');
  });

  it('signup success should NOT set userId when backend returns none', async () => {
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true as any);

    fillValidForm();
    component.onSubmit();

    const req = httpMock.expectOne(API);
    req.flush({ email: 'test@email.com' }); // no userId/id/_id

    await Promise.resolve();

    expect(sessionStorage.getItem('userId')).toBeNull(); // covers if(userId) false
    expect(navSpy).toHaveBeenCalledWith(['/chatbox']);
  });

  // =========================
  // error branches (+ focus behavior)
  // =========================
  it('backend errors (username + email + general) should set errors and focus username', async () => {
    const { userFocusSpy, emailFocusSpy } = spyFocus();
    const detectSpy = vi.spyOn((component as any).cdr, 'detectChanges');

    fillValidForm();
    component.onSubmit();

    const req = httpMock.expectOne(API);
    req.flush(
      { username: 'Username taken', email: 'Email taken', general: 'General error' },
      { status: 400, statusText: 'Bad Request' }
    );

    await Promise.resolve();

    expect(component.usernameError).toBe('Username taken');
    expect(component.emailError).toBe('Email taken');
    expect(component.generalError).toBe('General error');

    expect(component.f.username.errors?.['backendTaken']).toBe(true);
    expect(component.f.email.errors?.['backendTaken']).toBe(true);

    expect(userFocusSpy).toHaveBeenCalled();
    expect(emailFocusSpy).not.toHaveBeenCalled();
    expect(detectSpy).toHaveBeenCalled();
  });

  it('backend email error only should focus email', async () => {
    const { userFocusSpy, emailFocusSpy } = spyFocus();

    fillValidForm();
    component.onSubmit();

    const req = httpMock.expectOne(API);
    req.flush({ email: 'Email taken' }, { status: 400, statusText: 'Bad Request' });

    await Promise.resolve();

    expect(component.emailError).toBe('Email taken');
    expect(emailFocusSpy).toHaveBeenCalled();
    expect(userFocusSpy).not.toHaveBeenCalled();
  });

  it('unknown error payload should set generic generalError', async () => {
    const detectSpy = vi.spyOn((component as any).cdr, 'detectChanges');

    fillValidForm();
    component.onSubmit();

    const req = httpMock.expectOne(API);
    req.flush('Server crash', { status: 500, statusText: 'Server Error' });

    await Promise.resolve();

    expect(component.generalError).toBe('Signup failed. Please try again.');
    expect(detectSpy).toHaveBeenCalled();
  });

    it('allowedEmailValidator should return emailFormat when domain has <2 parts (a@localhost)', () => {
    component.f.email.setValue('a@localhost');
    component.f.email.updateValueAndValidity();
    expect(component.f.email.errors?.['emailFormat']).toBe(true);
  });

  it('allowedEmailValidator should return null for empty email (required handles it)', () => {
    component.f.email.setValue('');
    component.f.email.updateValueAndValidity();

    // required should exist
    expect(component.f.email.errors?.['required']).toBe(true);

    // validator should not add these
    expect(component.f.email.errors?.['emailFormat']).toBeUndefined();
    expect(component.f.email.errors?.['emailDomainNotAllowed']).toBeUndefined();
  });

  it('showErr should return true when invalid and dirty (covers ctrl.dirty branch)', () => {
    const ctrl = component.f.username;
    ctrl.setValue(''); // required
    ctrl.markAsDirty();
    ctrl.updateValueAndValidity();
    expect(component.showErr(ctrl)).toBe(true);
  });

  it('signup success should fallback to payload.email when backend does not return email', async () => {
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true as any);

    fillValidForm();
    component.onSubmit();

    const req = httpMock.expectOne(API);
    req.flush({ userId: '123' }); // 👈 no email

    await Promise.resolve();

    expect(sessionStorage.getItem('userEmail')).toBe('test@email.com'); // payload.email
    expect(navSpy).toHaveBeenCalledWith(['/chatbox']);
  });

  it('signup success should handle null response (forces userId fallback to empty string)', async () => {
    fillValidForm();
    component.onSubmit();

    const req = httpMock.expectOne(API);
    req.flush(null); // 👈 res is null

    await Promise.resolve();

    // still should navigate, but userId won't be set
    expect(sessionStorage.getItem('userId')).toBeNull();
  });

  it('allowedEmailValidator should set emailFormat when domain has <2 parts (a@localhost)', () => {
    component.f.email.setValue('a@localhost');
    component.f.email.updateValueAndValidity();
    expect(component.f.email.errors?.['emailFormat']).toBe(true);
  });

  it('allowedEmailValidator should return null for empty email (required handles it)', () => {
    component.f.email.setValue('');
    component.f.email.updateValueAndValidity();

    expect(component.f.email.errors?.['required']).toBe(true);
    expect(component.f.email.errors?.['emailFormat']).toBeUndefined();
    expect(component.f.email.errors?.['emailDomainNotAllowed']).toBeUndefined();
  });

  it('trimControl should NOT setValue when already trimmed (username)', () => {
    const setSpy = vi.spyOn(component.f.username, 'setValue');

    component.f.username.setValue('tester'); // seed value
    setSpy.mockClear(); // ✅ ignore the seed call

    (component as any).trimControl('username');

    expect(setSpy).not.toHaveBeenCalled();
  });

  it('trimControl should NOT setValue when already trimmed (email)', () => {
    const setSpy = vi.spyOn(component.f.email, 'setValue');

    component.f.email.setValue('test@email.com'); // seed value
    setSpy.mockClear(); // ✅ ignore the seed call

    (component as any).trimControl('email');

    expect(setSpy).not.toHaveBeenCalled();
  });

  it('onSubmit should build payload using ?? "" branches when values are null', async () => {
  // temporarily remove validators so null values can pass validation
  component.f.username.clearValidators();
  component.f.email.clearValidators();
  component.f.password.clearValidators();
  component.f.confirmPassword.clearValidators();

  component.f.username.setValue(null as any);
  component.f.email.setValue(null as any);
  component.f.password.setValue(null as any);
  component.f.confirmPassword.setValue(null as any);

  component.form.updateValueAndValidity();

  component.onSubmit();

  const req = httpMock.expectOne(API);

  // payload should be built with "" fallbacks
  expect(req.request.body).toEqual({
    username: '',
    email: '',
    password: '',
  });

  req.flush({ userId: 'x' }); // finish request
  await Promise.resolve();
});

it('signup success should handle null response (forces userId chain to final "")', async () => {
  fillValidForm();
  component.onSubmit();

  const req = httpMock.expectOne(API);
  req.flush(null); // res?.userId etc => all falsy -> ''

  await Promise.resolve();

  expect(sessionStorage.getItem('userId')).toBeNull(); // not set
});

it('backend returns empty object error -> no username/email/general set and no focus branch', async () => {
  const { userFocusSpy, emailFocusSpy } = spyFocus();

  fillValidForm();
  component.onSubmit();

  const req = httpMock.expectOne(API);
  req.flush({}, { status: 400, statusText: 'Bad Request' });

  await Promise.resolve();

  expect(component.usernameError).toBe('');
  expect(component.emailError).toBe('');
  expect(component.generalError).toBe('');

  expect(userFocusSpy).not.toHaveBeenCalled();
  expect(emailFocusSpy).not.toHaveBeenCalled();
});

it('showErr should return true when invalid and dirty', () => {
  const ctrl = component.f.username;
  ctrl.setValue('');
  ctrl.markAsDirty();
  ctrl.updateValueAndValidity();
  expect(component.showErr(ctrl)).toBe(true);
});

it('allowedEmailValidator should return null when value is null (required handles it)', () => {
  component.f.email.setValue(null as any);
  component.f.email.updateValueAndValidity();

  expect(component.f.email.errors?.['required']).toBe(true);
  expect(component.f.email.errors?.['emailFormat']).toBeUndefined();
  expect(component.f.email.errors?.['emailDomainNotAllowed']).toBeUndefined();
});

it('matchPasswords should return null when passwords match (no passwordMismatch)', () => {
  component.f.password.setValue('Strong1!');
  component.f.confirmPassword.setValue('Strong1!');
  component.form.updateValueAndValidity();

  expect(component.form.errors).toBeNull();
});

it('strongPasswordValidator should return null when password is strong', () => {
  component.f.password.setValue('Strong1!');
  component.f.password.updateValueAndValidity();

  expect(component.f.password.errors).toBeNull();
});

it('allowedEmailValidator should set emailFormat when domain has <2 parts (a@localhost)', () => {
  component.f.email.setValue('a@localhost');
  component.f.email.updateValueAndValidity();
  expect(component.f.email.errors?.['emailFormat']).toBe(true);
});

it('allowedEmailValidator should set emailFormat when email format is invalid', () => {
  component.f.email.setValue('not-an-email');
  component.f.email.updateValueAndValidity();
  expect(component.f.email.errors?.['emailFormat']).toBe(true);
});

it('matchPasswords should return null when passwords match', () => {
  component.f.password.setValue('Strong1!');
  component.f.confirmPassword.setValue('Strong1!');
  component.form.updateValueAndValidity();
  expect(component.form.errors).toBeNull();
});

it('strongPasswordValidator should return null when password is strong', () => {
  component.f.password.setValue('Strong1!');
  component.f.password.updateValueAndValidity();
  expect(component.f.password.errors).toBeNull();
});

it('allowedEmailValidator should hit !basic and return emailFormat=true (covers line 55)', () => {
  component.f.email.setValue('abc'); // non-empty, but NOT a valid email
  component.f.email.updateValueAndValidity();

  // required should NOT be present because value is not empty
  expect(component.f.email.errors?.['required']).toBeUndefined();

  // must hit !basic branch
  expect(component.f.email.errors?.['emailFormat']).toBe(true);
});

it('strongPasswordValidator should return null when password is strong (covers null)', () => {
  component.f.password.setValue('Strong1!');
  component.f.password.updateValueAndValidity();
  expect(component.f.password.errors).toBeNull();
});

it('matchPasswords should return null when passwords match (covers null)', () => {
  component.f.password.setValue('Strong1!');
  component.f.confirmPassword.setValue('Strong1!');
  component.form.updateValueAndValidity();

  expect(component.form.errors).toBeNull();
});

it('DIRECT allowedEmailValidator -> !basic hits emailFormat (line 55)', () => {
  const ctrl = new FormControl('abc');
  expect(allowedEmailValidator(ctrl as any)).toEqual({ emailFormat: true });
});

it('DIRECT allowedEmailValidator -> parts.length < 2 hits emailFormat', () => {
  const ctrl = new FormControl('a@localhost');
  expect(allowedEmailValidator(ctrl as any)).toEqual({ emailFormat: true });
});

it('DIRECT allowedEmailValidator -> empty returns null', () => {
  const ctrl = new FormControl('');
  expect(allowedEmailValidator(ctrl as any)).toBeNull();
});

it('DIRECT strongPasswordValidator -> strong returns null (covers null line)', () => {
  const ctrl = new FormControl('Strong1!');
  expect(strongPasswordValidator(ctrl as any)).toBeNull();
});

it('DIRECT matchPasswords -> matching returns null (covers null line)', () => {
  const fg = new FormGroup({
    password: new FormControl('Strong1!'),
    confirmPassword: new FormControl('Strong1!'),
  });
  expect(matchPasswords(fg as any)).toBeNull();
});

it('DIRECT allowedEmailValidator -> allowed by last1 (.com) returns null', () => {
  const ctrl = new FormControl('a@b.com');
  expect(allowedEmailValidator(ctrl as any)).toBeNull();
});

it('DIRECT allowedEmailValidator -> allowed by last2 (.com.ph) returns null', () => {
  const ctrl = new FormControl('a@b.com.ph');
  expect(allowedEmailValidator(ctrl as any)).toBeNull();
});

});