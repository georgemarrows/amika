Importer
- [x] only 家 listed as a kanji for 建築家. Similar problem for 専門家. Need to search for more examples to fix this properly.
- [x] first 5 words aren't words

UI
- [x] display kun reading about reading description. Currently displays reading vertically to left of descriptino. For example, ![For example](bugpics/kun_reading_bug.png). Keep stars on same row as reading, justified right.
- [x] Kanji and Word display pages should clear pane stack and just display their lists. That includes removing the Home page
- [x] If a pane already exists for a kanji or word, clicking on the kanji/word again should scroll back to the existing pane. Instead nothing happens, which is confusing.
- [x] typing in Japanese mode searches on each keypress / selection of alternative kanji choices. This is great, but when I press Enter to select the correct spelling, the same Enter press goes to the search box and the search completes. This means I can't pick things from the list.
- [x] when typing in any lang, the search runs repeatedly on each keypress - good. But the search results flicker, perhaps with a "Loading.." message. Can we delay this considerably or switch to a spinner? The flickering is very distracting when typing quickly.
- [x] only 2 characters are shown for 3 character words. ![screenshot](bugpics/three_character_word_bug.png)

Code review
- [ ] clean up repetitiion in api.ts
- [ ] clean up branching in app.ts createApp. Should we be using a lightweight router? Nest.js??
- [ ] refactor repositories.ts searchLibrary to have less duplication.
