# Модуль заметок

Небольшой backend-фрагмент: пользователь создаёт, читает, меняет и удаляет **только свои** заметки. Это не полноценное приложение – без frontend, JWT, Docker и HTTP-контроллеров.

## Структура модуля

```
prisma/schema.prisma     # User, Note, связи, индексы
src/notes/
  notes.types.ts         # Note, UpdateNoteDto, ошибки сервиса
  notes.service.ts       # updateNote – единственный реализованный метод
docs/
  API.md                 # эндпоинты, примеры, ошибки
  QUESTIONS.md           # ответы на вопросы задания
```

Слой контроллера в этом репозитории намеренно не пишется. В реальном NestJS-модуле он выглядел бы так:

- `NotesController` – маршруты, достаёт `userId` из auth, мапит ошибки сервиса в HTTP.
- `NotesService` – бизнес-правила, в том числе «нельзя трогать чужую заметку».
- Prisma – доступ к PostgreSQL.

Проверка владельца живёт в сервисе и в SQL-условии `{ id, userId }`, а не в контроллере.

## Что реализовано

1. **API** – [docs/API.md](docs/API.md): `POST/GET/PATCH/DELETE /notes`, пагинация списка, `404` на чужие записи.
2. **Prisma** – [prisma/schema.prisma](prisma/schema.prisma): `User` 1–N `Note`, каскадное удаление, индексы под изоляцию и список.
3. **Метод изменения** – `NotesService.updateNote(userId, noteId, data)` в [src/notes/notes.service.ts](src/notes/notes.service.ts):
   - меняет только `title` и `content`;
   - обновляет строку одним запросом `WHERE id AND userId`;
   - отсутствие и чужая заметка → одна ошибка `NoteNotFoundError` (снаружи `404`).
4. **Вопросы** – [docs/QUESTIONS.md](docs/QUESTIONS.md).

## Метод обновления (кратко)

```ts
await this.prisma.note.update({
  where: { id: noteId, userId },
  data: patch, // только title и/или content
});
```

Prisma (extended where-unique, 4.5+) применит `UPDATE` только к строке с обоими полями. Если строки нет, придёт `P2025` – сервис не выясняет, чужая это заметка или её никогда не было.

Невалидный UUID (`userId` / `noteId`) отклоняется до запроса в БД с `NoteValidationError` (400). `content` в модели – `string | null`: в задании поле опциональное, в PostgreSQL это NULL.
