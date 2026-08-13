/**
 * В задании content?: string (поле можно не передавать).
 * В БД Prisma `String?` – это string | null: заметка без текста хранится как NULL, не как отсутствие ключа.
 * PATCH с content: null явно очищает текст; отсутствие ключа content текст не трогает.
 */
export type Note = {
  id: string;
  title: string;
  content: string | null;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
};

export type UpdateNoteDto = {
  title?: string;
  content?: string | null;
};

/** И нет записи, и чужая - одна ошибка: снаружи 404, факт чужого владения не светим. */
export class NoteNotFoundError extends Error {
  readonly statusCode = 404;
  readonly code = 'NOTE_NOT_FOUND';

  constructor() {
    super('Note not found');
    this.name = 'NoteNotFoundError';
  }
}

export class NoteValidationError extends Error {
  readonly statusCode = 400;
  readonly code = 'NOTE_VALIDATION_ERROR';

  constructor(message: string) {
    super(message);
    this.name = 'NoteValidationError';
  }
}

/**
 * Узкий контракт вместо полного Prisma Client: в задании один метод, без генерации клиента.
 * where требует и id, и userId – extended where-unique (Prisma 4.5+): id уже @id,
 * userId добавляется как фильтр, чтобы UPDATE не прошёл по чужой строке.
 */
export type NotesPrisma = {
  note: {
    update(args: {
      where: { id: string; userId: string };
      data: { title?: string; content?: string | null };
    }): Promise<Note>;
  };
};
