import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AuthService } from './auth';

describe('AuthService (100%)', () => {
  let service: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AuthService);
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('setSession stores token and optional userId/email', () => {
    service.setSession({ token: 't1', userId: 'u1', email: 'e1@test.com' });

    expect(sessionStorage.getItem('token')).toBe('t1');
    expect(sessionStorage.getItem('userId')).toBe('u1');
    expect(sessionStorage.getItem('email')).toBe('e1@test.com');
  });

  it('setSession stores only token when optional fields missing', () => {
    service.setSession({ token: 't2' });

    expect(sessionStorage.getItem('token')).toBe('t2');
    expect(sessionStorage.getItem('userId')).toBeNull();
    expect(sessionStorage.getItem('email')).toBeNull();
  });

  it('getToken/getUserId/getEmail return stored values', () => {
    sessionStorage.setItem('token', 't3');
    sessionStorage.setItem('userId', 'u3');
    sessionStorage.setItem('email', 'e3@test.com');

    expect(service.getToken()).toBe('t3');
    expect(service.getUserId()).toBe('u3');
    expect(service.getEmail()).toBe('e3@test.com');
  });

  it('getToken/getUserId/getEmail return null when missing', () => {
    expect(service.getToken()).toBeNull();
    expect(service.getUserId()).toBeNull();
    expect(service.getEmail()).toBeNull();
  });

  it('isLoggedIn returns false when token missing, true when token exists', () => {
    expect(service.isLoggedIn()).toBe(false);

    sessionStorage.setItem('token', 't4');
    expect(service.isLoggedIn()).toBe(true);
  });

  it('logout removes token, userId, and email', () => {
    sessionStorage.setItem('token', 't5');
    sessionStorage.setItem('userId', 'u5');
    sessionStorage.setItem('email', 'e5@test.com');

    service.logout();

    expect(sessionStorage.getItem('token')).toBeNull();
    expect(sessionStorage.getItem('userId')).toBeNull();
    expect(sessionStorage.getItem('email')).toBeNull();
    expect(service.isLoggedIn()).toBe(false);
  });
});