import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PreviewArchive } from './preview-archive';

describe('PreviewArchive', () => {
  let component: PreviewArchive;
  let fixture: ComponentFixture<PreviewArchive>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PreviewArchive]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PreviewArchive);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
