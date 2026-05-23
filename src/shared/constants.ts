export const APP_NAME = 'Church Projector'
export const TARGET_WIDTH = 1920
export const TARGET_HEIGHT = 1080

export const IPC_CHANNELS = {
  PROJECTION_COMMAND: 'projection:command',
  PROJECTION_STATE: 'projection:state',
  SHORTCUT_FIRED: 'shortcut:fired',
  GET_DISPLAYS: 'displays:get',
  GET_SETTINGS: 'settings:get',
  SET_SETTINGS: 'settings:set',
  GET_MEDIA: 'media:list',
  MEDIA_UPDATED: 'media:updated',
  SCAN_MEDIA: 'media:scan',
  SCAN_AUDIO: 'audio:scan',
  GET_SONGS: 'songs:get',
  SAVE_SONG: 'songs:save',
  DELETE_SONG: 'songs:delete',
  GET_BIBLE_VERSIONS: 'bible:getVersions',
  SEARCH_VERSE: 'bible:searchVerse',
  SHOW_OPEN_DIALOG: 'dialog:showOpen'
} as const
