import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './signup.html',
  styleUrls: ['./signup.scss'],
})
export class Signup {
  constructor(private router: Router) {}

  onSubmit(event: SubmitEvent) {
    event.preventDefault();

    const form = event.target as HTMLFormElement;
    const email = (form.elements.namedItem('email') as HTMLInputElement)?.value?.trim() ?? '';
    const password = (form.elements.namedItem('password') as HTMLInputElement)?.value ?? '';
    const confirm = (form.elements.namedItem('confirmPassword') as HTMLInputElement)?.value ?? '';

    if (!email || !password || !confirm) {
      alert('Please fill out all fields.');
      return;
    }

    if (password !== confirm) {
      alert('Passwords do not match.');
      return;
    }

    // TODO: send data to backend. For now, just log and navigate.
    console.log('Signup data:', { email });
    alert('Signup successful (demo)');
    this.router.navigate(['/login']);
  }

}
