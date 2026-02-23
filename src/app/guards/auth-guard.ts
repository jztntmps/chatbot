import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export const authGuard: CanActivateFn = () => {
  const router = inject(Router);

  // ✅ sessionStorage clears when tab/browser is closed
  const isLoggedIn = sessionStorage.getItem('isLoggedIn') === 'true';
  const userId = sessionStorage.getItem('userId');

  if (!isLoggedIn || !userId) {
    router.navigate(['/indexlogin']);
    return false;
  }

  return true;
};