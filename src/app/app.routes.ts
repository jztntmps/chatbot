import { Routes } from '@angular/router';
import { IndexLogin } from './indexlogin/indexlogin';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./login/login').then(m => m.Login),
  },
  {
    path: 'chatbox',
    loadComponent: () =>
      import('./layout/component/chatbox/chatbox').then(m => m.Chatbox),
  },
   { path: 'indexlogin', component: IndexLogin }, 
];
