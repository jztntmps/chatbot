import {
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { timeout } from 'rxjs/operators';

import { ConversationService, Conversation } from '../../../services/conversation';
import { UiModalService } from '../../../shared/ui-modal/ui-modal.service';

type ArchiveRow = {
  id: string;
  title: string;
  date: string;
  checked: boolean;
};

@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './modal.html',
  styleUrls: ['./modal.scss'],
})
export class Modal implements OnInit {
  @Output() close = new EventEmitter<void>();
  @Output() changed = new EventEmitter<void>();

  @Input() userId = '';

  rows: ArchiveRow[] = [];
  loading = false;

  constructor(
    private router: Router,
    private convoApi: ConversationService,
    private cdr: ChangeDetectorRef,
    private uiModal: UiModalService // ✅ ADD
  ) {}

  async ngOnInit() {
    await this.loadArchived();
  }

  onClose() {
    this.close.emit();
  }

  private notifyChanged() {
    this.changed.emit();
  }

  private extractId(c: any): string | null {
    return c?.conversationId || c?.id || c?._id || null;
  }

  private formatDate(iso?: string): string {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    });
  }

  async loadArchived() {
    if (!this.userId) {
      this.rows = [];
      return;
    }

    this.loading = true;
    this.cdr.detectChanges();

    try {
      const list: Conversation[] = await firstValueFrom(
        this.convoApi.getByUser(this.userId).pipe(timeout(120000))
      );
      /* c8 ignore start */
      const archivedOnly = (list || []).filter((c: any) => c.archived === true);
      /* c8 ignore stop */
      this.rows = archivedOnly
        .map((c: any) => ({
          id: this.extractId(c) || '',
          title: c.title || '(Untitled)',
          date: this.formatDate(c.createdAt),
          checked: false,
        }))
        .filter((r) => !!r.id);
    } catch (e) {
      console.error('Failed loading archived', e);
      this.rows = [];
      await this.uiModal.notify({
        title: 'Load failed',
        message: 'Failed to load archived chats.',
        variant: 'danger',
        icon: 'warning',
        autoCloseMs: 3000,
      });
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  get allChecked() {
    return this.rows.length > 0 && this.rows.every((r) => r.checked);
  }

  toggleAll(checked: boolean) {
    this.rows = this.rows.map((r) => ({ ...r, checked }));
  }

  goToPreview(row: ArchiveRow) {
    this.router.navigate(['/preview-archive'], { queryParams: { id: row.id } });
  }

  // ✅ single unarchive
  async unarchiveOne(row: ArchiveRow, ev?: MouseEvent) {
    ev?.stopPropagation();

    const ok = await this.uiModal.confirm({
      title: 'Restore chat?',
      message: `Unarchive "${row.title}"?`,
      variant: 'neutral',
      icon: 'question',
      confirmText: 'Restore',
      cancelText: 'Cancel',
      showCancel: true,
    });

    if (!ok) return;

    try {
      await firstValueFrom(
        this.convoApi.unarchiveConversation(row.id).pipe(timeout(120000))
      );

      this.rows = this.rows.filter((r) => r.id !== row.id);
      this.notifyChanged();
      this.cdr.detectChanges();

      await this.uiModal.notify({
        title: 'Restored',
        message: 'Chat has been restored successfully.',
        variant: 'success',
        icon: 'success',
        autoCloseMs: 3000,
      });
    } catch (e) {
      console.error('Unarchive failed', e);
      await this.uiModal.notify({
        title: 'Restore failed',
        message: 'Failed to restore chat.',
        variant: 'danger',
        icon: 'warning',
        autoCloseMs: 3000,
      });
    }
  }

  // ✅ single delete
  async deleteOne(row: ArchiveRow, ev?: MouseEvent) {
    ev?.stopPropagation();

    const ok = await this.uiModal.confirm({
      title: 'Delete archived chat?',
      message: `This will permanently delete "${row.title}". Continue?`,
      variant: 'danger',
      icon: 'warning',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      showCancel: true,
    });

    if (!ok) return;

    try {
      await firstValueFrom(
        this.convoApi.deleteConversation(row.id).pipe(timeout(120000))
      );

      this.rows = this.rows.filter((r) => r.id !== row.id);
      this.notifyChanged();
      this.cdr.detectChanges();

      await this.uiModal.notify({
        title: 'Deleted',
        message: 'Archived chat deleted successfully.',
        variant: 'success',
        icon: 'success',
        autoCloseMs: 3000,
      });
    } catch (e) {
      console.error('Delete failed', e);
      await this.uiModal.notify({
        title: 'Delete failed',
        message: 'Failed to delete archived chat.',
        variant: 'danger',
        icon: 'warning',
        autoCloseMs: 3000,
      });
    }
  }

  // ✅ bulk unarchive
  async unarchiveSelected() {
    const selected = this.rows.filter((r) => r.checked);
    if (selected.length === 0) return;

    const count = selected.length;

    const ok = await this.uiModal.confirm({
      title: 'Restore selected chats?',
      message: `Restore ${count} archived chat${count > 1 ? 's' : ''}?`,
      variant: 'neutral',
      icon: 'question',
      confirmText: 'Restore',
      cancelText: 'Cancel',
      showCancel: true,
    });

    if (!ok) return;

    try {
      for (const r of selected) {
        await firstValueFrom(
          this.convoApi.unarchiveConversation(r.id).pipe(timeout(120000))
        );
      }

      this.rows = this.rows.filter((r) => !r.checked);
      this.notifyChanged();
      this.cdr.detectChanges();

      await this.uiModal.notify({
        title: 'Restored',
        /* c8 ignore start */
        message: `${count} chat${count > 1 ? 's' : ''} restored successfully.`,
        /* c8 ignore stop */
        variant: 'success',
        icon: 'success',
        autoCloseMs: 3000,
      });
    } catch (e) {
      console.error('Bulk unarchive failed', e);
      await this.uiModal.notify({
        title: 'Restore failed',
        message: 'Failed to restore selected chats.',
        variant: 'danger',
        icon: 'warning',
        autoCloseMs: 3000,
      });
    }
  }

  // ✅ bulk delete
  async deleteSelected() {
    const selected = this.rows.filter((r) => r.checked);
    if (selected.length === 0) return;

    const count = selected.length;

    const ok = await this.uiModal.confirm({
      title: 'Delete selected chats?',
      message: `This will permanently delete ${count} archived chat${count > 1 ? 's' : ''}. Continue?`,
      variant: 'danger',
      icon: 'warning',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      showCancel: true,
    });

    if (!ok) return;

    try {
      for (const r of selected) {
        await firstValueFrom(
          this.convoApi.deleteConversation(r.id).pipe(timeout(120000))
        );
      }

      this.rows = this.rows.filter((r) => !r.checked);
      this.notifyChanged();
      this.cdr.detectChanges();

      await this.uiModal.notify({
        title: 'Deleted',
        /* c8 ignore start */
        message: `${count} archived chat${count > 1 ? 's' : ''} deleted successfully.`,
        /* c8 ignore stop */
        variant: 'success',
        icon: 'success',
        autoCloseMs: 3000,
      });
    } catch (e) {
      console.error('Bulk delete failed', e);
      await this.uiModal.notify({
        title: 'Delete failed',
        message: 'Failed to delete selected chats.',
        variant: 'danger',
        icon: 'warning',
        autoCloseMs: 3000,
      });
    }
  }
}