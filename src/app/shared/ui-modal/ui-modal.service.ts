import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type UiModalVariant = 'danger' | 'success' | 'neutral';

export type UiModalState =
  | {
      open: true;
      title: string;
      message: string;

      variant: UiModalVariant; // danger=red, success=green
      icon: 'warning' | 'question' | 'success';

      cancelText?: string; // default Cancel
      confirmText?: string; // default OK
      showCancel?: boolean; // default true

      _resolve?: (v: boolean) => void;
    }
  | { open: false };

@Injectable({ providedIn: 'root' })
export class UiModalService {
  private readonly state$ = new BehaviorSubject<UiModalState>({ open: false });
  modal$ = this.state$.asObservable();

  close() {
    this.state$.next({ open: false });
  }

  confirm(opts: {
    title: string;
    message: string;
    variant?: UiModalVariant;
    icon?: 'warning' | 'question' | 'success';
    cancelText?: string;
    confirmText?: string;
    showCancel?: boolean;
  }): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this.state$.next({
        open: true,
        title: opts.title,
        message: opts.message,
        variant: opts.variant ?? 'neutral',
        icon: opts.icon ?? 'question',
        cancelText: opts.cancelText ?? 'Cancel',
        confirmText: opts.confirmText ?? 'OK',
        showCancel: opts.showCancel ?? true,
        _resolve: resolve,
      });
    });
  }


  notify(opts: {
    title: string;
    message: string;
    variant?: UiModalVariant;
    icon?: 'warning' | 'question' | 'success';
    confirmText?: string;     // default OK
    autoCloseMs?: number;     // e.g. 3000
  }): Promise<void> {
    return new Promise<void>((resolve) => {
      let done = false;

      const finish = () => {
        if (done) return;
        done = true;
        resolve();
      };

      this.state$.next({
        open: true,
        title: opts.title,
        message: opts.message,
        variant: opts.variant ?? 'success',
        icon: opts.icon ?? 'success',
        confirmText: opts.confirmText ?? 'OK',
        showCancel: false,
        _resolve: () => finish(),
      });

      const ms = opts.autoCloseMs ?? 0;
      if (ms > 0) {
        setTimeout(() => {
          // close only if still open (avoid closing newer modal)
          const s = this.state$.value;
          if (s.open) this.close();
          finish();
        }, ms);
      }
    });
  }

 
  _resolve(result: boolean) {
    const s = this.state$.value;
    if (s.open && s._resolve) s._resolve(result);
    this.close();
  }
}