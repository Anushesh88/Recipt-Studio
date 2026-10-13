# Demo video

`docs/demo/receipt-studio-demo.mp4` (1280x720, about 70 seconds) is recorded
from the real app by `record-demo.spec.ts`: landing page, sign up, business
details and brand kit, a branded café template, a bill with a UPI QR, sending it
on WhatsApp, and the sales report. A cursor and captions are drawn on the page.

To record it again after the app changes:

1. Start the backend and frontend locally (they're in `.claude/launch.json`).
2. From `frontend/`, run:

   ```bash
   npx playwright test -c demo/playwright.demo.config.ts
   ```

3. Convert the recording to MP4:

   ```bash
   ffmpeg -y -i demo/out/record-demo-record-the-demo/video.webm -c:v libx264 -crf 20 -pix_fmt yuv420p -movflags +faststart ../docs/demo/receipt-studio-demo.mp4
   ```

Captions are in `record-demo.spec.ts` (`caption(...)` calls); change the words there.
