import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FooterComponent } from './layout/component/footer/footer'; // ✅ FIXED
import { UiModalComponent } from '../../src/app/shared/ui-modal/ui-modal.component';
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, FooterComponent,UiModalComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class AppComponent {}
