import { describe, expect, it } from 'vitest'
import {
  clavePlataforma,
  elegirAssetDeRelease,
  urlListaReleases,
  urlUltimaRelease
} from '@/shared/utils/githubReleases'

/**
 * La forma de las releases de whisper.cpp en septiembre de 2026: la "latest"
 * (v1.9.4) sin binarios, y los paquetes en releases `bNNNN`. Es exactamente
 * lo que dejó la instalación desde la app dando 404.
 */
const RELEASES = [
  { tag_name: 'v1.9.4', draft: false, assets: [] },
  {
    tag_name: 'b5130',
    draft: false,
    assets: [
      { name: 'whisper-bin-x64.zip', browser_download_url: 'https://x/b5130/whisper-bin-x64.zip' },
      {
        name: 'whisper-bin-ubuntu-x64.tar.gz',
        browser_download_url: 'https://x/b5130/whisper-bin-ubuntu-x64.tar.gz'
      }
    ]
  },
  {
    tag_name: 'b5127',
    draft: false,
    assets: [
      { name: 'whisper-bin-x64.zip', browser_download_url: 'https://x/b5127/whisper-bin-x64.zip' }
    ]
  }
]

describe('elegirAssetDeRelease', () => {
  it('saltea la release sin binarios y toma la más nueva que lo tenga', () => {
    expect(elegirAssetDeRelease(RELEASES, 'whisper-bin-x64.zip')).toBe(
      'https://x/b5130/whisper-bin-x64.zip'
    )
    expect(elegirAssetDeRelease(RELEASES, 'whisper-bin-ubuntu-x64.tar.gz')).toContain('b5130')
  })

  it('ignora los borradores', () => {
    const conBorrador = [
      { draft: true, assets: [{ name: 'a.zip', browser_download_url: 'https://x/borrador/a.zip' }] },
      { draft: false, assets: [{ name: 'a.zip', browser_download_url: 'https://x/real/a.zip' }] }
    ]
    expect(elegirAssetDeRelease(conBorrador, 'a.zip')).toBe('https://x/real/a.zip')
  })

  it('devuelve null si nadie lo tiene, o si la respuesta no es una lista', () => {
    expect(elegirAssetDeRelease(RELEASES, 'no-existe.zip')).toBeNull()
    expect(elegirAssetDeRelease({ message: 'API rate limit exceeded' }, 'a.zip')).toBeNull()
    expect(elegirAssetDeRelease(null, 'a.zip')).toBeNull()
  })
})

describe('urls', () => {
  it('arma las direcciones de la API y del atajo', () => {
    expect(urlListaReleases('ggml-org/whisper.cpp')).toBe(
      'https://api.github.com/repos/ggml-org/whisper.cpp/releases?per_page=15'
    )
    expect(urlUltimaRelease('yt-dlp/yt-dlp', 'yt-dlp.exe')).toBe(
      'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe'
    )
    expect(clavePlataforma('linux', 'arm64')).toBe('linux-arm64')
  })
})
