import { TestBed } from '@angular/core/testing';
import { CanActivateFn, Router } from '@angular/router';
import { provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { authGuard } from './auth-guard';

describe('authGuard', () => {
  const executeGuard: CanActivateFn = (...guardParameters) =>
    TestBed.runInInjectionContext(() => authGuard(...guardParameters));

  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([])],
    });

    router = TestBed.inject(Router);
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('should block and navigate to /indexlogin when not logged in', () => {
    // not logged in
    sessionStorage.removeItem('isLoggedIn');
    sessionStorage.removeItem('userId');

    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true as any);

    const result = executeGuard({} as any, {} as any);

    expect(result).toBe(false);
    expect(navSpy).toHaveBeenCalledWith(['/indexlogin']);
  });

  it('should block and navigate to /indexlogin when isLoggedIn is false', () => {
    sessionStorage.setItem('isLoggedIn', 'false');
    sessionStorage.setItem('userId', 'u-1');

    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true as any);

    const result = executeGuard({} as any, {} as any);

    expect(result).toBe(false);
    expect(navSpy).toHaveBeenCalledWith(['/indexlogin']);
  });

  it('should block and navigate to /indexlogin when userId is missing', () => {
    sessionStorage.setItem('isLoggedIn', 'true');
    sessionStorage.removeItem('userId');

    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true as any);

    const result = executeGuard({} as any, {} as any);

    expect(result).toBe(false);
    expect(navSpy).toHaveBeenCalledWith(['/indexlogin']);
  });

  it('should allow when isLoggedIn is true and userId exists', () => {
    sessionStorage.setItem('isLoggedIn', 'true');
    sessionStorage.setItem('userId', 'u-1');

    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true as any);

    const result = executeGuard({} as any, {} as any);

    expect(result).toBe(true);
    expect(navSpy).not.toHaveBeenCalled();
  });
});