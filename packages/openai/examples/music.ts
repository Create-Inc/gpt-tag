import { openai } from "..";

const base = openai.debug(true).model("gpt-4");
const mood = "sad electronic jazz";

const chords = base`Generate a chord progression to match the following mood: ${mood}`;

const streaming = base.stream(true);

const melody = streaming`Generate a song in ABC notation to be layered on top of a chord progression.

Chord: ${chords}

It should have the following musical style: ${mood}


Example:
X:1
T:Speed the Plough
M:4/4
C:Trad.
K:G
|:GABc dedB|dedB dedB|c2ec B2dB|c2A2 A2BA|
  GABc dedB|dedB dedB|c2ec B2dB|A2F2 G4:|
|:g2gf gdBd|g2f2 e2d2|c2ec B2dB|c2A2 A2df|
  g2gf g2Bd|g2f2 e2d2|c2ec B2dB|A2F2 G4:|`;

(async () => {
  await melody.get();
})();
