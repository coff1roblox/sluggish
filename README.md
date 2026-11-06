# جاوبني

A two-team Arabic trivia party game for one shared screen (TV, laptop or phone). The host reads the questions and judges the answers.

- 43 categories, 532 questions, three levels (200 / 400 / 600)
- Each team picks 3 categories, so every game uses 6 categories and 36 questions
- Timer with a steal chance for the other team, plus 3 one-time helpers per team: double it (دبّلها), swap question (بدّل السؤال), and +30 seconds (وقت زيادة)
- Remembers questions you've already seen and prefers new ones; saves the game in progress
- Keyboard: Space reveals the answer, 1 / 2 picks the team that got it right, 0 means nobody, S steal, P pause, F fullscreen, M mute

## Play

Open `index.html` in any browser. It's one self-contained file.

## Edit questions

Questions live in `src/data/*.js` as `[level, question, answer]`, where level 1 = 200, 2 = 400, 3 = 600. After editing, rebuild:

```
node build.js
```

The build stops if a category has fewer than 3 questions at any level, or if a question is duplicated.
