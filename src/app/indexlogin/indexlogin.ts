import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-indexlogin',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './indexlogin.html',
  styleUrls: ['./indexlogin.scss'],
})
export class IndexLogin {
  email = '';
  password = '';
  showPassword = false;
  errorMsg = '';
  loading = false;

  // ⚠️ Make sure this matches your backend controller mapping
  private apiUrl = 'http://localhost:8080/api/auth/login';

  constructor(private http: HttpClient, private router: Router) {}

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  goHome() {
    this.router.navigate(['/']);
  }

  clearError() {
    if (this.errorMsg) this.errorMsg = '';
  }

  login() {
    this.errorMsg = '';

    if (!this.email || !this.password) {
      this.errorMsg = 'Email and password are required';
      return;
    }

    this.loading = true;

    this.http
      .post<any>(this.apiUrl, { email: this.email.trim(), password: this.password })
      .subscribe({
        next: (res) => {
          // ✅ get real user id from backend response
          const userId = res?.userId || res?.id || res?._id;

          if (!userId) {
            this.errorMsg = 'Login succeeded but userId was not returned by backend.';
            this.loading = false;
            return;
          }

          localStorage.setItem('isLoggedIn', 'true');
          localStorage.setItem('userEmail', res?.email || this.email.trim());
          localStorage.setItem('userId', userId); // ✅ IMPORTANT

          // ✅ go to your chat route
          this.router.navigate(['/chatbox']);
          this.loading = false;
        },
        error: (err) => {
          this.errorMsg = err?.error?.message || 'Invalid email or password';
          this.loading = false;
        },
      });
  }
}
