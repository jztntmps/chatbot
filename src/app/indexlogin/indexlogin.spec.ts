import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Indexlogin } from './indexlogin';

describe('Indexlogin', () => {
  let component: Indexlogin;
  let fixture: ComponentFixture<Indexlogin>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Indexlogin]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Indexlogin);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
