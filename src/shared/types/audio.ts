export interface AudioTrack {
  id: string
  filePath: string
  title: string
  artist?: string
  album?: string
  duration: number
  artworkPath?: string
  addedAt: string
}

export interface AudioPlaylist {
  id: string
  name: string
  trackIds: string[]
  createdAt: string
  updatedAt: string
}

export interface AudioPlayerState {
  currentTrackId: string | null
  isPlaying: boolean
  volume: number
  position: number
  shuffle: boolean
  repeat: 'off' | 'one' | 'all'
  crossfadeDuration: number
}
