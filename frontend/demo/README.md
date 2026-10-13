# Demo videos

Two versions, about 70 seconds each:
- `docs/demo/receipt-studio-demo.mp4`: landscape 1280x720, for YouTube, LinkedIn and the website.
- `docs/demo/receipt-studio-demo-vertical.mp4`: vertical 1080x1920, for Reels, Shorts and WhatsApp Status. It shows the app's phone layout.

Both are recorded
from the real app by `record-demo.spec.ts`: landing page, sign up, business
details and brand kit, a branded café template, a bill with a UPI QR, sending it
on WhatsApp, and the sales report. A cursor and captions are drawn on the page.

To record it again after the app changes:

1. Start the backend and frontend locally (they're in `.claude/launch.json`).
2. From `frontend/`, run:

   ```bash
   npx playwright test -c demo/playwright.demo.config.ts
   ```

   (add `--project=landscape` or `--project=vertical` for just one)

3. Convert the recordings to MP4. The vertical one is recorded at 540x960 and scaled up 2x:

   ```bash
   ffmpeg -y -i demo/out/record-demo-record-the-demo-landscape/video.webm -c:v libx264 -crf 20 -pix_fmt yuv420p -movflags +faststart ../docs/demo/receipt-studio-demo.mp4
   ```

   ```bash
   ffmpeg -y -i demo/out/record-demo-record-the-demo-vertical/video.webm -vf scale=1080:1920:flags=lanczos -c:v libx264 -crf 19 -pix_fmt yuv420p -movflags +faststart ../docs/demo/receipt-studio-demo-vertical.mp4
   ```

Captions are in `record-demo.spec.ts` (`caption(...)` calls); change the words there.
