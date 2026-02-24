import {
  Component,
  inject,
  ViewChild,
  ElementRef,
  ChangeDetectorRef,
  DestroyRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';

import { finalize } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-indexlogin',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './indexlogin.html',
  styleUrls: ['./indexlogin.scss'],
})
export class IndexLogin {
  private http = inject(HttpClient);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);

  @ViewChild('emailInput') emailInput?: ElementRef<HTMLInputElement>;

  email = '';
  password = '';
  showPassword = false;
  errorMsg = '';
  loading = false;

  private apiUrl = 'http://localhost:8080/api/auth/login';

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  goHome() {
    this.router.navigate(['/']);
  }

  clearError() {
    // ✅ if user starts typing again, remove message
    if (this.errorMsg) this.errorMsg = '';
  }

  login() {
    // ✅ prevent double submit habang loading
    if (this.loading) return;

    this.errorMsg = '';

    const email = (this.email || '').trim();
    const password = this.password || '';

    if (!email || !password) {
      this.errorMsg = 'Email and password are required';
      return;
    }

    this.loading = true;

    this.http
      .post<any>(this.apiUrl, { email, password })
      .pipe(
        takeUntilDestroyed(this.destroyRef),

        // ✅ ALWAYS reset loading (success OR error OR throw)
        finalize(() => {
          this.loading = false;
          this.cdr.detectChanges(); // helps if UI gets “stuck”
        })
      )
      .subscribe({
        next: (res) => {
          const userId = res?.userId || res?.id || res?._id;

          if (!userId) {
            this.errorMsg = 'Login succeeded but userId was not returned by backend.';
            return;
          }

          sessionStorage.setItem('isLoggedIn', 'true');
          sessionStorage.setItem('userEmail', res?.email || email);
          sessionStorage.setItem('userId', userId);

          this.router.navigate(['/chatbox']);
        },
        error: (err: HttpErrorResponse) => {
          // ✅ handle backend status codes
          if (err?.status === 409) {
            this.errorMsg = 'Invalid email or password';
          } else if (err?.status === 401) {
            this.errorMsg = 'Invalid email or password';
          } else {
            this.errorMsg = err?.error?.message || 'Login failed. Please try again.';
          }
        },
      });
  }
}