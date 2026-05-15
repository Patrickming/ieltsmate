import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

describe('NoteUserImageStorage path safety', () => {
  let uploadRoot: string
  let originalRoot: string | undefined

  beforeEach(() => {
    originalRoot = process.env.NOTE_USER_IMAGE_ROOT
    uploadRoot = mkdtempSync(join(tmpdir(), 'ieltsmate-storage-safety-'))
    process.env.NOTE_USER_IMAGE_ROOT = uploadRoot
  })

  afterEach(() => {
    jest.resetModules()
    jest.unmock('node:fs/promises')
    rmSync(uploadRoot, { recursive: true, force: true })
    if (originalRoot === undefined) {
      delete process.env.NOTE_USER_IMAGE_ROOT
      return
    }
    process.env.NOTE_USER_IMAGE_ROOT = originalRoot
  })

  it('removeMany ignores invalid public paths and traversal attempts', async () => {
    const { NoteUserImageStorage } = await import('../src/notes/note-user-image.storage')
    const storage = new NoteUserImageStorage()
    const invalidPrefixTarget = join(uploadRoot, 'not-a-public-path')
    const escapedTarget = resolve(uploadRoot, '..', 'escaped.txt')

    writeFileSync(invalidPrefixTarget, 'inside-root')
    writeFileSync(escapedTarget, 'outside-root')

    await storage.removeMany(['not-a-public-path', '/note-user-images/../escaped.txt'])

    expect(existsSync(invalidPrefixTarget)).toBe(true)
    expect(existsSync(escapedTarget)).toBe(true)
  })

  it('saveMany removes already-written files when a later write fails', async () => {
    const actualFsPromises =
      jest.requireActual<typeof import('node:fs/promises')>('node:fs/promises')
    let callCount = 0

    jest.doMock('node:fs/promises', () => ({
      ...actualFsPromises,
      writeFile: jest.fn(async (...args: Parameters<typeof actualFsPromises.writeFile>) => {
        callCount += 1
        if (callCount === 1) {
          return actualFsPromises.writeFile(...args)
        }
        throw new Error('disk full')
      }),
    }))

    const { NoteUserImageStorage } = await import('../src/notes/note-user-image.storage')
    const storage = new NoteUserImageStorage()

    const files = [
      {
        buffer: Buffer.from('a'),
        mimetype: 'image/png',
        originalname: 'a.png',
      },
      {
        buffer: Buffer.from('b'),
        mimetype: 'image/png',
        originalname: 'b.png',
      },
    ] as Express.Multer.File[]

    await expect(storage.saveMany(files)).rejects.toThrow('disk full')

    const entries = readdirSync(uploadRoot, { recursive: true, withFileTypes: true })
    expect(entries.some((entry) => entry.isFile())).toBe(false)
  })
})
