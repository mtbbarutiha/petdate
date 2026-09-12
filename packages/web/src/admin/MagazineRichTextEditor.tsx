import { useCallback, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold,
  Heading2,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Undo2,
} from 'lucide-react';
import { adminFetch } from './api';
import { tr } from '../i18n';

type Props = {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  placeholder?: string;
};

export function MagazineRichTextEditor({
  value,
  onChange,
  disabled,
  placeholder = 'متن کامل مقاله را بنویسید…',
}: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Image.configure({ allowBase64: false }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: value || '',
    editable: !disabled,
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (value !== current && value !== editor.getText()) {
      // Avoid clobbering caret while typing the same doc
      if (normalizeHtml(value) !== normalizeHtml(current)) {
        editor.commands.setContent(value || '', { emitUpdate: false });
      }
    }
  }, [editor, value]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [editor, disabled]);

  const uploadImage = useCallback(async () => {
    if (!editor || disabled) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp,image/gif';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const fd = new FormData();
        fd.append('file', file);
        const data = await adminFetch<{ url: string }>('/api/admin/magazine/upload', {
          method: 'POST',
          body: fd,
        });
        if (data.url) {
          editor.chain().focus().setImage({ src: data.url, alt: file.name }).run();
        }
      } catch (err) {
        window.alert(err instanceof Error ? err.message : 'آپلود ناموفق');
      }
    };
    input.click();
  }, [editor, disabled]);

  const setLink = useCallback(() => {
    if (!editor || disabled) return;
    const prev = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('آدرس لینک', prev || 'https://');
    if (url === null) return;
    if (!url.trim()) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run();
  }, [editor, disabled]);

  if (!editor) return null;

  return (
    <div className={`mag-editor${disabled ? ' is-disabled' : ''}`}>
      <div className="mag-editor-toolbar" role="toolbar" aria-label={tr("ویرایشگر متن")}>
        <button
          type="button"
          className={editor.isActive('bold') ? 'is-on' : ''}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title={tr("پررنگ")}
        >
          <Bold size={15} />
        </button>
        <button
          type="button"
          className={editor.isActive('italic') ? 'is-on' : ''}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title={tr("کج")}
        >
          <Italic size={15} />
        </button>
        <button
          type="button"
          className={editor.isActive('heading', { level: 2 }) ? 'is-on' : ''}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          title={tr("عنوان")}
        >
          <Heading2 size={15} />
        </button>
        <button
          type="button"
          className={editor.isActive('bulletList') ? 'is-on' : ''}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title={tr("فهرست")}
        >
          <List size={15} />
        </button>
        <button
          type="button"
          className={editor.isActive('orderedList') ? 'is-on' : ''}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title={tr("فهرست شماره‌دار")}
        >
          <ListOrdered size={15} />
        </button>
        <button
          type="button"
          className={editor.isActive('blockquote') ? 'is-on' : ''}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          title={tr("نقل‌قول")}
        >
          <Quote size={15} />
        </button>
        <button type="button" disabled={disabled} onClick={() => void setLink()} title={tr("لینک")}>
          <Link2 size={15} />
        </button>
        <button type="button" disabled={disabled} onClick={() => void uploadImage()} title={tr("درج تصویر")}>
          <ImagePlus size={15} />
        </button>
        <span className="mag-editor-sep" aria-hidden />
        <button
          type="button"
          disabled={disabled || !editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}
          title={tr("بازگردانی")}
        >
          <Undo2 size={15} />
        </button>
        <button
          type="button"
          disabled={disabled || !editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()}
          title={tr("جلو")}
        >
          <Redo2 size={15} />
        </button>
      </div>
      <EditorContent editor={editor} className="mag-editor-body" />
    </div>
  );
}

function normalizeHtml(html: string): string {
  return (html || '').replace(/\s+/g, ' ').trim();
}
