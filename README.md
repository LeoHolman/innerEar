# Inner Ear

A polished browser app that records microphone input in real time and shows the detected pitch on a vertically scrolling piano roll.

## How to run

This project is a static site, so you only need a local web server. Do not open `index.html` directly from disk if you want microphone access, because the browser will usually block `getUserMedia` on `file://` URLs.

### Option 1: Python

From the project folder:

```bash
python3 -m http.server 4173
```

Then open:

```text
http://localhost:4173
```

### Option 2: Any static server

You can also use any other local static file server, as long as it serves the files over `http://localhost` or `https://`.

## What you should see

- A microphone start/stop button
- An Exercises button with a Pitch Matching preset
- Live note, frequency, and cents readouts
- A vertical piano-roll visualization with note guide lines

## Pitch Matching

Open Exercises to launch Pitch Matching.

- Set the lowest and highest notes you can comfortably sing.
- Start the exercise to hear a hidden prompt tone chosen from that range.
- After the prompt tone, there is a default 3-second ready delay before matching begins.
- Sing the pitch back within about +/-35 cents of the target and hold it steadily for one second to succeed.
- After each attempt, the app reveals the target note and gives success or try-again feedback.

## Pitch Memory

Open Exercises, switch the Exercise selector to Pitch Memory, then:

- Set the lowest and highest notes in your comfortable range.
- Set the delay in seconds (1 to 100).
- Start the exercise to hear a prompt tone.
- After the delay minus 3 seconds, the app starts a 3, 2, 1, Go countdown.
- Sing the remembered pitch on Go and hold it for one second to pass.
- The app reveals the target note and reports success or try-again after each attempt.
- Pitch Memory keeps an 8-second default delay value.

## Match the Scale

Open Exercises, switch the Exercise selector to Match the Scale, then:

- Set your lowest and highest comfortable notes.
- Choose the scale type (Major, Minor, or Pentatonic).
- Choose the direction (Ascending or Descending).
- Start the exercise to hear one tonic note.
- After the tonic, there is a default 3-second ready delay before singing starts.
- Sing through each degree in the selected direction, holding each degree in tune for one second.
- The selected tonic is chosen so the full target scale stays inside your selected low/high range.
- When the attempt ends, the roll overlays target note outlines against your sung contour so you can see where each degree drifted.

## Random Scale Degree

Open Exercises, switch the Exercise selector to Random Scale Degree, then:

- Set your lowest and highest comfortable notes.
- Choose whether tonic is random.
- If Random tonic is off, pick a fixed tonic note.
- Start the exercise to hear a tonic note.
- After the tonic, there is a default 3-second ready delay before you sing.
- The app shows a degree number (for example, 3 means the major 3rd above the tonic).
- Sing that degree and hold it in tune for one second to pass.
- If you do not match it in time, the attempt is marked incorrect.

## Notes

- The app uses your microphone, so you will need to allow browser access when prompted.
- If the pitch tracker seems unstable, sing a sustained vowel or hum a single note for best results.
- The app works best in a Chromium-based browser or Safari with microphone permissions enabled.
