import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertGameSchema } from "@shared/schema";
import { z } from "zod";
import { spawn } from "child_process";
import path from "path";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.post('/api/games', async (req, res) => {
    try {
      const gameData = insertGameSchema.parse(req.body);
      const game = await storage.createGame(gameData);
      
      // Trigger background processing
      // We pass the game ID and image URL to the python script
      const pythonProcess = spawn('python3', [
        path.join(process.cwd(), 'server', 'process_image.py'),
        game.id.toString(),
        game.imageUrl
      ]);

      pythonProcess.stdout.on('data', (data) => {
        console.log(`Python stdout: ${data}`);
      });

      pythonProcess.stderr.on('data', (data) => {
        console.error(`Python stderr: ${data}`);
      });

      pythonProcess.on('close', (code) => {
        console.log(`Python process exited with code ${code}`);
      });

      res.status(201).json(game);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: err.errors });
      } else {
        res.status(500).json({ message: "Internal Server Error" });
      }
    }
  });

  app.get('/api/games/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    const game = await storage.getGame(id);
    if (!game) {
      return res.status(404).json({ message: "Game not found" });
    }
    res.json(game);
  });

  app.patch('/api/games/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    const { pgn } = req.body;
    try {
      const game = await storage.updateGame(id, { pgn });
      res.json(game);
    } catch (err) {
      res.status(500).json({ message: "Failed to update game" });
    }
  });

  app.get('/api/games', async (req, res) => {
    const games = await storage.listGames();
    res.json(games);
  });

  return httpServer;
}
