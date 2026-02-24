import { Routes } from '@angular/router';
import { authGuard } from './guards/auth-guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./login/login').then(m => m.Login),
  },
  {
    path: 'indexlogin',
    loadComponent: () =>
      import('./indexlogin/indexlogin').then(m => m.IndexLogin),
  },

  // ✅ PROTECTED
  {
    path: 'chatbox',
    loadComponent: () =>
      import('./layout/component/chatbox/chatbox').then(m => m.Chatbox),
  },

  {
    path: 'signup',
    loadComponent: () =>
      import('./signup/signup').then(m => m.Signup),
  },

  // ✅ PROTECTED (optional but recommended)
  {
    path: 'preview-archive',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./layout/component/preview-archive/preview-archive').then(m => m.PreviewArchive),
  },
];
