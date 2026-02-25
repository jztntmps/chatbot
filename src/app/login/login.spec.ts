import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { describe, it, expect, beforeEach, vi } from 'vitest'; // ✅ import vi
import { Login } from './login';

describe('Login', () => {
  let component: Login;
  let fixture: ComponentFixture<Login>;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [provideRouter([])],
    })
      
      .compileComponents();

    fixture = TestBed.createComponent(Login);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('goToChat should navigate to /chatbox', () => {
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true as any);

    component.goToChat();

    expect(navSpy).toHaveBeenCalledWith(['/chatbox']);
  });

  it('goToIndexLogin should navigate to /indexlogin', () => {
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true as any);

    component.goToIndexLogin();

    expect(navSpy).toHaveBeenCalledWith(['/indexlogin']);
  });
});