import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

type ChatPreview = {
  id: string;
  title: string;
};

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sidebar.html',
  styleUrls: ['./sidebar.scss'],
})
export class SidebarComponent {
  @Input() isOpen = true;
  @Input() username = 'User';
  @Input() avatarUrl = ''; // optional (if empty, shows default)

  @Input() chats: ChatPreview[] = [
    { id: '1', title: '...' },
    { id: '2', title: '...' },
    { id: '3', title: '...' },
  ];

  @Output() toggle = new EventEmitter<void>();
  @Output() newChat = new EventEmitter<void>();
  @Output() openChat = new EventEmitter<string>();
  @Output() seeAll = new EventEmitter<void>();
  @Output() settings = new EventEmitter<void>();

  trackById(_: number, c: ChatPreview) {
    return c.id;
  }
}
