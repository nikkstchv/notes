import {
  Note,
  NotesPrisma,
  NoteNotFoundError,
  NoteValidationError,
  UpdateNoteDto,
} from './notes.types';

const PRISMA_RECORD_NOT_FOUND = 'P2025';

/** Совпадает с @default(uuid()) в схеме. Невалидный id – 400, не 404: записи с таким ключом быть не может. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isPrismaNotFoundError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === PRISMA_RECORD_NOT_FOUND
  );
}

export class NotesService {
  constructor(private readonly prisma: NotesPrisma) {}

  /**
   * Меняет только свою заметку одним UPDATE WHERE id AND userId.
   * Транзакция не нужна: один атомарный UPDATE в PostgreSQL.
   * userId обязан прийти из auth-контекста контроллера, не из body.
   */
  async updateNote(
    userId: string,
    noteId: string,
    data: UpdateNoteDto,
  ): Promise<Note> {
    this.assertId(userId, 'userId');
    this.assertId(noteId, 'noteId');

    const patch = this.toUpdateData(data);

    try {
      return await this.prisma.note.update({
        where: { id: noteId, userId },
        data: patch,
      });
    } catch (error) {
      // P2025: 0 строк. Не делаем отдельный find – иначе гонка и утечка типа запись есть, но чужая.
      if (isPrismaNotFoundError(error)) {
        throw new NoteNotFoundError();
      }

      throw error;
    }
  }

  private assertId(value: string, field: string): void {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new NoteValidationError(`${field} is required`);
    }

    if (!UUID_RE.test(value)) {
      throw new NoteValidationError(`${field} must be a UUID`);
    }
  }

  private toUpdateData(data: UpdateNoteDto): {
    title?: string;
    content?: string | null;
  } {
    if (data == null || typeof data !== 'object' || Array.isArray(data)) {
      throw new NoteValidationError('Update payload is required');
    }

    // Собираем whitelist вручную: spread data пропустил бы userId/id/createdAt.
    const patch: { title?: string; content?: string | null } = {};

    if (Object.prototype.hasOwnProperty.call(data, 'title')) {
      if (typeof data.title !== 'string') {
        throw new NoteValidationError('title must be a string');
      }

      const title = data.title.trim();

      if (title.length === 0) {
        throw new NoteValidationError('title must not be empty');
      }

      patch.title = title;
    }

    if (Object.prototype.hasOwnProperty.call(data, 'content')) {
      if (data.content !== null && typeof data.content !== 'string') {
        throw new NoteValidationError('content must be a string or null');
      }

      // hasOwnProperty, а не `data.content !== undefined`: null – валидная очистка текста.
      patch.content = data.content;
    }

    if (Object.keys(patch).length === 0) {
      throw new NoteValidationError(
        'At least one of title or content must be provided',
      );
    }

    return patch;
  }
}
