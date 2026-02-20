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
  // ✅ close modal
  @Output() close = new EventEmitter<void>();

  // ✅ notify parent to refresh sidebar list (after unarchive/delete)
  @Output() changed = new EventEmitter<void>();

  // ✅ passed from parent
  @Input() userId = '';

  rows: ArchiveRow[] = [];
  loading = false;

  constructor(
    private router: Router,
    private convoApi: ConversationService,
    private cdr: ChangeDetectorRef
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
      console.log('NO USER ID (Modal)');
      this.rows = [];
      return;
    }

    this.loading = true;
    this.cdr.detectChanges();

    try {
      const list: Conversation[] = await firstValueFrom(
        this.convoApi.getByUser(this.userId).pipe(timeout(120000))
      );

      const archivedOnly = (list || []).filter((c: any) => c.archived === true);

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

  // ✅ single unarchive: archived=false only (NOT delete)
  async unarchiveOne(row: ArchiveRow, ev?: MouseEvent) {
    ev?.stopPropagation();

    try {
      await firstValueFrom(
        this.convoApi.unarchiveConversation(row.id).pipe(timeout(120000))
      );

      // remove from archive modal list
      this.rows = this.rows.filter((r) => r.id !== row.id);

      // tell parent to refresh sidebar list
      this.notifyChanged();

      this.cdr.detectChanges();
    } catch (e) {
      console.error('Unarchive failed', e);
      alert('Failed to unarchive conversation.');
    }
  }

  // ✅ single delete: totally delete in DB
  async deleteOne(row: ArchiveRow, ev?: MouseEvent) {
    ev?.stopPropagation();
    const ok = confirm('Delete this archived chat?');
    if (!ok) return;

    try {
      await firstValueFrom(
        this.convoApi.deleteConversation(row.id).pipe(timeout(120000))
      );

      this.rows = this.rows.filter((r) => r.id !== row.id);

      // tell parent to refresh sidebar list
      this.notifyChanged();

      this.cdr.detectChanges();
    } catch (e) {
      console.error('Delete failed', e);
      alert('Failed to delete conversation in database.');
    }
  }

  // ✅ bulk unarchive: archived=false only (NOT delete)
  async unarchiveSelected() {
    const selected = this.rows.filter((r) => r.checked);
    if (selected.length === 0) return;

    try {
      for (const r of selected) {
        await firstValueFrom(
          this.convoApi.unarchiveConversation(r.id).pipe(timeout(120000))
        );
      }

      this.rows = this.rows.filter((r) => !r.checked);

      // tell parent to refresh sidebar list
      this.notifyChanged();

      this.cdr.detectChanges();
    } catch (e) {
      console.error('Bulk unarchive failed', e);
      alert('Failed to unarchive selected chats.');
    }
  }

  // ✅ bulk delete: totally delete in DB
  async deleteSelected() {
    const selected = this.rows.filter((r) => r.checked);
    if (selected.length === 0) return;

    const ok = confirm(`Delete ${selected.length} archived chat(s)?`);
    if (!ok) return;

    try {
      for (const r of selected) {
        await firstValueFrom(
          this.convoApi.deleteConversation(r.id).pipe(timeout(120000))
        );
      }

      this.rows = this.rows.filter((r) => !r.checked);

      // tell parent to refresh sidebar list
      this.notifyChanged();

      this.cdr.detectChanges();
    } catch (e) {
      console.error('Bulk delete failed', e);
      alert('Failed to delete selected chats.');
    }
  }
}