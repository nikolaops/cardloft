# Local Ticketing

Jednostavna offline ticketing aplikacija za macOS. Sadrži:

- Kanban board sa drag-and-drop karticama
- sprint board i odvojeni backlog
- custom kolone, njihov redosled i boje
- tikete sa opisom, privatnim notes, prioritetom i komentarima
- custom labele u bojama
- više potpuno odvojenih projekata i brzo prebacivanje između njih
- lista i management projekata direktno u sidebar-u
- editovanje naziva i boje, uz vizuelni opcioni emoji picker za svaki projekat
- finalni naslov projekta u formatu `emoji + razmak + projectName`
- centrirana Kanban/Sprint/Backlog navigacija iznad ticket kolona
- Labels dugme u board navigaciji za direktan pristup project labelama
- jasno Delete ticket dugme sa native macOS confirmation dijalogom
- project-scoped Notes/rokovnik sa sticky note karticama, bojama i edit/delete opcijama
- svaki projekat ima potpuno odvojenu Notes sesiju
- pouzdan pointer drag-and-drop tiketa između kolona
- standardna macOS title traka za normalno pomeranje prozora
- potpuno lokalno čuvanje podataka

## Instalacija

Otvori `build/Local-Ticketing-1.5.0.dmg`, pa prevuci **Local Ticketing** u **Applications**.

Aplikacija je ad-hoc potpisana za lokalnu upotrebu, ali nije notarizovana Apple Developer sertifikatom. Ako Gatekeeper prikaže upozorenje, uradi Control-click na aplikaciju, izaberi **Open**, pa potvrdi još jednom.

Podaci se čuvaju u:

```text
~/Library/Application Support/LocalTicketing/workspace.json
```

Promene se upisuju i u native JSON fajl i u WebKit lokalni storage, tako da običan reload ne vraća board na početno stanje. Stariji single-project podaci se pri prvom pokretanju automatski migriraju u prvi projekat.

## Build

Potreban je macOS sa Command Line Tools. Nisu potrebni Docker, Xcode projekat, Node moduli ili internet.

```bash
./build.sh
```

Build skripta kompajlira mali native AppKit/WebKit host, generiše `.app`, ad-hoc ga potpisuje i pakuje DMG u `build/` direktorijum.
