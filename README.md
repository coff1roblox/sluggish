# جاوبني

A two-team Arabic trivia party game for one shared screen (TV, laptop or phone). The host reads the questions and judges the answers.

- 53 categories, about 670 questions, three levels (200 / 400 / 600), each with a photo
- Picture rounds: flags, "where is this place?", "who is this player?"
- Each team picks 3 categories, so every game uses 6 categories and 36 questions
- Timer with a steal chance for the other team, plus 3 one-time helpers per team: double it (دبّلها), swap question (بدّل السؤال), and +30 seconds (وقت زيادة)
- Remembers questions you've already seen and prefers new ones; saves the game in progress
- Keyboard: Space reveals the answer, 1 / 2 picks the team that got it right, 0 means nobody, S steal, P pause, F fullscreen, M mute

## Play

Open `index.html` in any browser. Keep the `photos/` folder next to it.

## Photos

Every photo is free-licensed from Wikipedia / Wikimedia Commons; the author and license show under each one in the game. Most photos appear only when the answer is revealed so they don't give it away; picture rounds (and a few questions where the photo doesn't spoil anything) show it with the question.

## Edit questions

Questions live in `src/data/*.js` as `[level, question, answer, photo, show]`:

- level: 1 = 200, 2 = 400, 3 = 600
- photo: an English Wikipedia article title (its lead image is used), `File:Name.jpg` on Wikimedia Commons, `search:words` for a Commons search, or `""` for none
- show (optional): `"q"` shows the photo with the question, `"a"` only with the answer

After editing, fetch any new photos and rebuild:

```
node build.js --keys | python3 tools/fetch_photos.py   # needs Pillow; skips photos already downloaded
node build.js
```

The build stops if a category has fewer than 3 questions at any level, or if a question is duplicated, and lists questions without a photo.

`node build.js --bundle` also writes `dist/`: the same game with one photo bundle per category instead of 640 separate files, for hosts that limit the file count (this is what the published Claude artifact uses).
