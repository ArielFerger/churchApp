export type SectionType = 'verse' | 'chorus' | 'bridge' | 'intro' | 'outro' | 'tag'

export interface Slide {
  id: string
  lines: string[]
}

export interface SongSection {
  id: string
  type: SectionType
  label: string
  slides: Slide[]
}

export interface Song {
  id: string
  title: string
  author?: string
  tags: string[]
  language: string
  createdAt: string
  updatedAt: string
  sections: SongSection[]
  order: string[]
}
