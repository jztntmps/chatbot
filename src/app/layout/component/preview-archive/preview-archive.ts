import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FooterComponent } from '../footer/footer';
import { SidebarComponent } from '../sidebar/sidebar';
import { Topbar } from '../topbar/topbar';
import { Router } from '@angular/router';

@Component({
  selector: 'app-preview-archive',
  standalone: true,
  imports: [CommonModule, FooterComponent, SidebarComponent, Topbar],
  templateUrl: './preview-archive.html',
  styleUrl: './preview-archive.scss',
})
export class PreviewArchive {
  isLoggedIn = true;
  sidebarOpen = true;
  userEmail = 'User';
  chats: { id: string; title: string }[] = [];

  constructor(private router: Router) {}

  toggleSidebar() {
    this.sidebarOpen = !this.sidebarOpen;
  }

  goLogin() {
    this.router.navigate(['/indexlogin']);
  }

  goSignup() {
    this.router.navigate(['/signup']);
  }

  goArchive() {
    // already here; no-op
  }

  logout() {
    this.isLoggedIn = false;
    this.sidebarOpen = false;
    this.router.navigate(['/']);
  }

  startNewChat() {
    // stub for integration
  }

  openChat(_id: string) {
    // stub for integration
  }

  seeAll() {
    // stub for integration
  }
}
