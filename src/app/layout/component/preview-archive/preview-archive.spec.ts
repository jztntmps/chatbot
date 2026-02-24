import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PreviewArchive } from './preview-archive';

describe('PreviewArchive', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PreviewArchive],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(PreviewArchive);
    expect(fixture.componentInstance).toBeTruthy();
  });
});