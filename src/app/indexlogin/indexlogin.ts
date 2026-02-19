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

  private apiUrl = 'http://localhost:8080/api/auth/login';

  constructor(private http: HttpClient, private router: Router) {}

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  login() {
    this.errorMsg = '';

    if (!this.email || !this.password) {
      this.errorMsg = 'Email and password are required';
      return;
    }

    this.http
      .post<any>(this.apiUrl, { email: this.email, password: this.password })
      .subscribe({
        next: () => {
          localStorage.setItem('isLoggedIn', 'true');
          localStorage.setItem('userEmail', this.email);

          // ✅ go to your chat route
          this.router.navigate(['/chatbox']);
        },
        error: (err) => {
          this.errorMsg = err?.error?.message || 'Invalid email or password';
        },
      });
  }
}
