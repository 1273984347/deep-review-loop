// src/app.ts — 实际启动端口是 3000，与 README 声称的 8000 不一致
import express from "express";

const app = express();
const port = Number(process.env.PORT ?? 3000); // README says 8000 — stale doc

app.get("/health", (_req, res) => res.json({ ok: true }));

app.listen(port, () => console.log(`listening on :${port}`));
