import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app';
import { appConfig } from './app/app.config';
import { provideHttpClient } from '@angular/common/http';

bootstrapApplication(AppComponent, {
  ...appConfig,   // spread existing config
  providers: [
    ...(appConfig.providers ?? []), // keep existing providers
    provideHttpClient()
  ]
})
.catch((err) => console.error(err));
