import { NotesService } from '../src/notes/notes.service'

describe('NotesService image cleanup guards', () => {
  function createSubject() {
    const prisma = {
      note: {
        findFirst: jest.fn().mockResolvedValue({ id: 'note-1' }),
      },
      noteUserNote: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'user-note-1',
          noteId: 'note-1',
          content: '旧备注',
          images: ['/note-user-images/2026/05/old.png'],
          deletedAt: null,
        }),
        update: jest.fn(),
      },
    }

    const storage = {
      saveMany: jest.fn(),
      removeMany: jest.fn(),
    }

    return {
      prisma,
      storage,
      service: new NotesService(prisma as never, storage as never),
    }
  }

  it('updateUserNote rolls back newly added files when DB update fails', async () => {
    const { service, prisma, storage } = createSubject()
    storage.saveMany.mockResolvedValue(['/note-user-images/2026/05/new.png'])
    prisma.noteUserNote.update.mockRejectedValue(new Error('db write failed'))
    storage.removeMany.mockResolvedValue(undefined)

    await expect(
      service.updateUserNote(
        'note-1',
        'user-note-1',
        { content: '新备注', keepImages: JSON.stringify([]) },
        [] as Express.Multer.File[],
      ),
    ).rejects.toThrow('db write failed')

    expect(storage.removeMany).toHaveBeenCalledTimes(1)
    expect(storage.removeMany).toHaveBeenCalledWith(['/note-user-images/2026/05/new.png'])
  })

  it('updateUserNote keeps successful DB result when old-image cleanup fails', async () => {
    const { service, prisma, storage } = createSubject()
    const updated = {
      id: 'user-note-1',
      noteId: 'note-1',
      content: '更新后备注',
      images: ['/note-user-images/2026/05/new.png'],
    }

    storage.saveMany.mockResolvedValue(['/note-user-images/2026/05/new.png'])
    prisma.noteUserNote.update.mockResolvedValue(updated)
    storage.removeMany.mockRejectedValueOnce(new Error('cleanup failed'))

    await expect(
      service.updateUserNote(
        'note-1',
        'user-note-1',
        { content: '更新后备注', keepImages: JSON.stringify([]) },
        [] as Express.Multer.File[],
      ),
    ).resolves.toEqual(updated)

    expect(storage.removeMany).toHaveBeenCalledTimes(1)
    expect(storage.removeMany).toHaveBeenCalledWith(['/note-user-images/2026/05/old.png'])
  })

  it('softDeleteUserNote keeps successful DB delete when image cleanup fails', async () => {
    const { service, prisma, storage } = createSubject()
    const deleted = {
      id: 'user-note-1',
      deletedAt: new Date('2026-05-15T10:00:00.000Z'),
    }

    prisma.noteUserNote.update.mockResolvedValue(deleted)
    storage.removeMany.mockRejectedValueOnce(new Error('cleanup failed'))

    await expect(service.softDeleteUserNote('note-1', 'user-note-1')).resolves.toEqual(deleted)

    expect(storage.removeMany).toHaveBeenCalledTimes(1)
    expect(storage.removeMany).toHaveBeenCalledWith(['/note-user-images/2026/05/old.png'])
  })
})
