export interface UserNote {
  id: string
  content: string
  images: string[]
  createdAt?: string
  updatedAt?: string
}

export interface DraftUserNoteImage {
  id: string
  file: File
  previewUrl: string
}
