import { Component } from '@angular/core';
import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-login',
  standalone: true,              // ✅ REQUIRED for standalone
  imports: [RouterModule],       // ✅ needed for routerLink
  templateUrl: './login.html',
  styleUrls: ['./login.scss'],   // ✅ must be styleUrls (plural)
})
/** c8 ignore start */
export class Login {
/** c8 ignore stop */
  constructor(private router: Router) {}

  goToChat() {
    this.router.navigate(['/chatbox']);
  }

  goToIndexLogin() {
    this.router.navigate(['/indexlogin']);
  }
}
