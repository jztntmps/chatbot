import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IndexLogin } from './indexlogin';

describe('IndexLogin', () => {
  let component: IndexLogin;
  let fixture: ComponentFixture<IndexLogin>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IndexLogin],    
    })
    .compileComponents();

    fixture = TestBed.createComponent(IndexLogin);
    component = fixture.componentInstance;  
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
