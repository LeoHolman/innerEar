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
- Sing the pitch back and hold it steadily for one second to succeed.
- After each attempt, the app reveals the target note and gives success or try-again feedback.

## Notes

- The app uses your microphone, so you will need to allow browser access when prompted.
- If the pitch tracker seems unstable, sing a sustained vowel or hum a single note for best results.
- The app works best in a Chromium-based browser or Safari with microphone permissions enabled.
