# ESF Simulation

Simple p5.js simulation for **Antibiotics & Infections**.

## Run locally

From the project folder:

```bash
python3 -m http.server 8000
```

Then open:

- http://localhost:8000

## Run without internet

This project is configured to run offline because p5 is stored locally at:

- `bac/p5.min.js`

And `index.html` loads that local file.

To run on another laptop with no internet:

1. Copy the **entire project folder** (including `bac/p5.min.js`).
2. On that laptop, open a terminal in the project folder.
3. Start the server:
   ```bash
   python3 -m http.server 8000
   ```
4. Open http://localhost:8000 in a browser.

## Notes

- If port 8000 is in use, choose another port (for example 8080):
  ```bash
  python3 -m http.server 8080
  ```
  then open http://localhost:8080
- Stop the server with `Ctrl + C`.
