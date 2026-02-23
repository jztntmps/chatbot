import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly TOKEN_KEY = 'token';
  private readonly USER_ID_KEY = 'userId';
  private readonly EMAIL_KEY = 'email';

  // ✅ store in sessionStorage so closing tab logs out automatically
  setSession(data: { token: string; userId?: string; email?: string }) {
    sessionStorage.setItem(this.TOKEN_KEY, data.token);
    if (data.userId) sessionStorage.setItem(this.USER_ID_KEY, data.userId);
    if (data.email) sessionStorage.setItem(this.EMAIL_KEY, data.email);
  }

  getToken(): string | null {
    return sessionStorage.getItem(this.TOKEN_KEY);
  }

  getUserId(): string | null {
    return sessionStorage.getItem(this.USER_ID_KEY);
  }

  getEmail(): string | null {
    return sessionStorage.getItem(this.EMAIL_KEY);
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  logout() {
    sessionStorage.removeItem(this.TOKEN_KEY);
    sessionStorage.removeItem(this.USER_ID_KEY);
    sessionStorage.removeItem(this.EMAIL_KEY);
  }
}