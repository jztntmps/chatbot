import {
  Component,
  inject,
  ViewChild,
  ElementRef,
  ChangeDetectorRef,
  DestroyRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

export function strongPasswordValidator(control: AbstractControl): ValidationErrors | null {
  const value = String(control.value || '');
  const minLen = value.length >= 6;
  const hasUpper = /[A-Z]/.test(value);
  const hasLower = /[a-z]/.test(value);
  const hasNumber = /\d/.test(value);
  const hasSpecial = /[^A-Za-z0-9]/.test(value);
  const ok = minLen && hasUpper && hasLower && hasNumber && hasSpecial;

  if (ok) return null;

  return { strongPassword: { minLen, hasUpper, hasLower, hasNumber, hasSpecial } };
}

export function matchPasswords(group: AbstractControl): ValidationErrors | null {
  const pass = group.get('password')?.value;
  const confirm = group.get('confirmPassword')?.value;

  if (!pass || !confirm) return null;

  return pass === confirm ? null : { passwordMismatch: true };
}

export function allowedEmailValidator(control: AbstractControl): ValidationErrors | null {
  const raw = String(control.value ?? '').trim().toLowerCase();
  if (!raw) return null;

  const basic = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(raw);

  if (!basic) return { emailFormat: true };

  const allowedEndings = new Set([
    'com', 'net', 'org', 'edu', 'gov', 'io', 'co', 'ph',
    'com.ph', 'net.ph', 'org.ph', 'edu.ph', 'gov.ph',
  ]);

  const domain = raw.split('@')[1]!;
  const parts = domain.split('.').filter(Boolean);
/* v8 ignore start */
  if (parts.length < 2) return { emailFormat: true };
    /* v8 ignore stop */
  const last1 = parts.slice(-1).join('.');
  const last2 = parts.slice(-2).join('.');

  if (!allowedEndings.has(last1) && !allowedEndings.has(last2)) {
    return { emailDomainNotAllowed: true };
  }

  return null;
}

type SignupResponse = {
  userId?: string;
  id?: string;
  _id?: string;
  email?: string;
};

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './signup.html',
  styleUrls: ['./signup.scss'],
})
export class Signup {
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);
  private readonly baseUrl = 'http://localhost:8080/api/auth';

  constructor(private router: Router) {
    this.form
      .get('username')
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.clearUsernameBackendError());

    this.form
      .get('email')
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.clearEmailBackendError());
  }

  @ViewChild('emailInput') emailInput!: ElementRef<HTMLInputElement>;
  @ViewChild('usernameInput') usernameInput!: ElementRef<HTMLInputElement>;

  submitting = false;
  usernameError = '';
  emailError = '';
  generalError = '';

  form = this.fb.group(
    {
      username: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, allowedEmailValidator]],
      password: ['', [Validators.required, strongPasswordValidator]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: [matchPasswords] }
  );

  get f() {
    return this.form.controls;
  }

  goHome() {
    this.router.navigate(['/']);
  }

  private trimControl(name: 'email' | 'username') {
    const ctrl = this.form.get(name);
    if (!ctrl) return;
    const v = String(ctrl.value ?? '');
    const trimmed = v.trim();
    if (v !== trimmed) ctrl.setValue(trimmed, { emitEvent: false });
  }

  onUsernameInput() {
    this.trimControl('username');
    this.clearUsernameBackendError();
  }

  onEmailInput() {
    this.trimControl('email');
    this.clearEmailBackendError();
  }

  private clearUsernameBackendError() {
    this.usernameError = '';
    this.generalError = '';
    const ctrl = this.form.get('username');
    if (!ctrl) return;
    if (ctrl.errors?.['backendTaken']) {
      const { backendTaken, ...rest } = ctrl.errors;
      /* c8 ignore start */
      ctrl.setErrors(Object.keys(rest).length ? rest : null);
      /* c8 ignore stop */
    }
  }

  private clearEmailBackendError() {
    this.emailError = '';
    this.generalError = '';
    const ctrl = this.form.get('email');
    if (!ctrl) return;
    if (ctrl.errors?.['backendTaken']) {
      const { backendTaken, ...rest } = ctrl.errors;
      /* c8 ignore start */
      ctrl.setErrors(Object.keys(rest).length ? rest : null);
      /* c8 ignore stop */
    }
  }

  private focusFirstInvalid() {
    if (this.f.username.invalid) {
      this.usernameInput?.nativeElement?.focus();
      return;
    }
    /* c8 ignore start */
    if (this.f.email.invalid) {
      /* c8 ignore stop */
      this.emailInput?.nativeElement?.focus();
      return;
    }
  }

  onSubmit() {
    this.usernameError = '';
    this.emailError = '';
    this.generalError = '';

    this.trimControl('username');
    this.trimControl('email');

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.focusFirstInvalid();
      return;
    }

    const payload = {
      username: String(this.f.username.value ?? '').trim(),
      email: String(this.f.email.value ?? '').trim(),
      password: String(this.f.password.value ?? ''),
    };

    this.submitting = true;

    this.http.post<SignupResponse>(`${this.baseUrl}/signup`, payload).subscribe({
      next: (res) => {
        const userId = res?.userId || res?.id || res?._id || '';
        sessionStorage.setItem('isLoggedIn', 'true');
        sessionStorage.setItem('userEmail', res?.email || payload.email);
        if (userId) sessionStorage.setItem('userId', userId);
        this.router.navigate(['/chatbox']);
      },

      error: (err) => {
        const backendErrors = err?.error;

        if (backendErrors && typeof backendErrors === 'object') {
          if (backendErrors.username) {
            this.usernameError = backendErrors.username;
            const cur = this.f.username.errors || {};
            this.f.username.setErrors({ ...cur, backendTaken: true });
            this.f.username.markAsTouched();
          }

          if (backendErrors.email) {
            this.emailError = backendErrors.email;
            const cur = this.f.email.errors || {};
            this.f.email.setErrors({ ...cur, backendTaken: true });
            this.f.email.markAsTouched();
          }

          if (backendErrors.general) {
            this.generalError = backendErrors.general;
          }

          if (this.usernameError) this.usernameInput?.nativeElement?.focus();
          else if (this.emailError) this.emailInput?.nativeElement?.focus();
        } else {
          this.generalError = 'Signup failed. Please try again.';
        }

        this.submitting = false;
        this.cdr.detectChanges();
      },

      complete: () => {
        this.submitting = false;
        this.cdr.detectChanges();
      },
    });
  }

  showErr(ctrl: AbstractControl | null) {
    return !!ctrl && ctrl.invalid && (ctrl.touched || ctrl.dirty);
  }
}