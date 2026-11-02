import * as express from "express";
import * as fs from "fs-extra";
import * as path from "path";
import { randomUUID } from "crypto";
import type { RequestHandler } from "express-serve-static-core";
import type { Server as SocketIOServer } from "socket.io";

// Fichas de personagem: um JSON por personagem em <data>/characters.
// ponytail: last-write-wins por ficha; versionar se mestre e jogador passarem a editar a mesma ficha ao mesmo tempo.

const ID = /^[a-zA-Z0-9-]{1,64}$/;

export default ({
  roleMiddleware,
  dataDirectory,
  io,
}: {
  roleMiddleware: { pc: RequestHandler; dm: RequestHandler };
  dataDirectory: string;
  io: SocketIOServer;
}) => {
  const router = express.Router();
  const directory = path.join(dataDirectory, "characters");
  fs.mkdirpSync(directory);
  const fileOf = (id: string) => path.join(directory, `${id}.json`);

  const notFound = (res: express.Response) =>
    res.status(404).json({ data: null, error: { code: "ERR_NOT_FOUND" } });

  router.get("/characters", roleMiddleware.pc, async (_, res) => {
    const files = (await fs.readdir(directory)).filter((f) =>
      f.endsWith(".json")
    );
    const characters = await Promise.all(
      files.map((f) => fs.readJson(path.join(directory, f)).catch(() => null))
    );
    res.json({ data: characters.filter(Boolean), error: null });
  });

  router.get("/characters/:id", roleMiddleware.pc, async (req, res) => {
    if (!ID.test(req.params.id)) return notFound(res);
    const character = await fs
      .readJson(fileOf(req.params.id))
      .catch(() => null);
    if (!character) return notFound(res);
    res.json({ data: character, error: null });
  });

  router.put("/characters/:id", roleMiddleware.pc, async (req, res) => {
    const id = req.params.id;
    const body = req.body;
    if (
      !ID.test(id) ||
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return res
        .status(422)
        .json({ data: null, error: { code: "ERR_INVALID_CHARACTER" } });
    }
    const character = { ...body, id, updatedAt: new Date().toISOString() };
    // grava e renomeia para nunca deixar uma ficha pela metade no disco
    const tmp = `${fileOf(id)}.${randomUUID()}.tmp`;
    await fs.writeJson(tmp, character);
    await fs.move(tmp, fileOf(id), { overwrite: true });
    io.emit("characters:changed", { id, updatedAt: character.updatedAt });
    res.json({ data: character, error: null });
  });

  router.delete("/characters/:id", roleMiddleware.pc, async (req, res) => {
    if (!ID.test(req.params.id)) return notFound(res);
    await fs.remove(fileOf(req.params.id));
    io.emit("characters:changed", { id: req.params.id, deleted: true });
    res.json({ data: { id: req.params.id }, error: null });
  });

  return router;
};
