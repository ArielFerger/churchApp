# Bible data

The app ships with two Spanish versions in `data/bibles/`:

| Version | Source | License |
|---|---|---|
| **RVR1909** — Reina-Valera 1909 | [bibliadelpueblo/ReinaValera1909](https://github.com/bibliadelpueblo/ReinaValera1909) | Public domain |
| **RVA-2015** — Reina-Valera Actualizada 2015 | [mrk214/bible-data-es-spa](https://github.com/mrk214/bible-data-es-spa) | © Editorial Mundo Hispano. Verify redistribution rights before public release. |

## How they're generated

The bundled JSONs are produced by `scripts/convert-bible.ts`:

```bash
npm run convert-bibles              # both versions
npm run convert-bibles -- rvr1909   # one only
npm run convert-bibles -- rva2015
```

The script downloads the source files, parses them, and writes
`data/bibles/<version>.json` matching the schema in `src/shared/types/bible.ts`.

## Schema

```ts
{
  metadata: { version: string, language: string, name: string },
  books: [
    {
      id: string,        // OSIS-style 3-letter (GEN, JHN, REV, …)
      name: string,      // Spanish display name
      chapters: [
        {
          number: number,
          verses: [{ number: number, text: string }]
        }
      ]
    }
  ]
}
```

Books not present in the source file appear as `{ id, name, chapters: [] }` so
the picker UI still renders them (greyed out).

## Adding more versions

1. Implement a `buildXxx()` function in `scripts/convert-bible.ts` that produces
   a `Bible` object.
2. Add a CLI key for it in `main()`.
3. Run the script — the output drops into `data/bibles/`.
4. The app picks it up on next launch (BibleService scans the folder).

## Path resolution

- **Dev**: read from `<repo>/data/bibles/`.
- **Production** (packaged by `electron-builder`): `extraResources` copies
  `data/` into the app's resources directory. The service resolves to
  `process.resourcesPath/data/bibles/`.
