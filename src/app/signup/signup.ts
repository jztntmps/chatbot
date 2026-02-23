import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './signup.html',
  styleUrls: ['./signup.scss'],
})
export class Signup {

  private http = inject(HttpClient);

  constructor(private router: Router) {}

  goHome() {
    this.router.navigate(['/']);
  }

  onSubmit(event: SubmitEvent) {
    event.preventDefault();

    const form = event.target as HTMLFormElement;

    const username = (form.elements.namedItem('username') as HTMLInputElement)?.value?.trim() ?? '';
    const email = (form.elements.namedItem('email') as HTMLInputElement)?.value?.trim() ?? '';
    const password = (form.elements.namedItem('password') as HTMLInputElement)?.value ?? '';
    const confirm = (form.elements.namedItem('confirmPassword') as HTMLInputElement)?.value ?? '';

    if (!username || !email || !password || !confirm) {
      alert('Please fill out all fields.');
      return;
    }

    if (password !== confirm) {
      alert('Passwords do not match.');
      return;
    }

    const userData = {
      username,
      email,
      password
    };

    this.http.post<any>('http://localhost:8080/api/auth/signup', userData)
      .subscribe({
        next: (res) => {
          const userId = res?.userId || res?.id || res?._id || '';
          localStorage.setItem('isLoggedIn', 'true');
          localStorage.setItem('userEmail', res?.email || email);
          if (userId) localStorage.setItem('userId', userId);
          this.router.navigate(['/chatbox']);
        },
        error: (err) => {
          console.error(err);
          alert('Signup failed.');
        }
      });
  }
}


