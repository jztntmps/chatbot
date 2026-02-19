import { Component } from '@angular/core';
import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-login',
  standalone: true,              // ✅ REQUIRED for standalone
  imports: [RouterModule],       // ✅ needed for routerLink
  templateUrl: './login.html',
  styleUrls: ['./login.scss'],   // ✅ must be styleUrls (plural)
})
export class Login {

  constructor(private router: Router) {}

  goToChat() {
    // do NOT set isLoggedIn
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('userEmail');

    this.router.navigate(['/chatbox']);
  }

}
