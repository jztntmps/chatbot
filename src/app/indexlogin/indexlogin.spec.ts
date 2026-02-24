import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { IndexLogin } from './indexlogin';

describe('IndexLogin', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IndexLogin],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(IndexLogin);
    expect(fixture.componentInstance).toBeTruthy();
  });
});