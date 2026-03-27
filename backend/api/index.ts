import app, { initializeApp } from "../src/index";

export default async function vercelHandler(req: any, res: any) {
  await initializeApp();
  return app(req, res);
}
