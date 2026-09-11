import { Router } from 'express';
import { dbService } from '../db';

export const catalogRouter = Router();

catalogRouter.get('/species', (_req, res) => {
  res.json(dbService.listSpecies());
});

catalogRouter.get('/breeds', (req, res) => {
  const species = typeof req.query.species === 'string' ? req.query.species : undefined;
  const q =
    typeof req.query.q === 'string'
      ? req.query.q
      : typeof req.query.search === 'string'
        ? req.query.search
        : undefined;
  res.json(dbService.listBreeds(species, q));
});
