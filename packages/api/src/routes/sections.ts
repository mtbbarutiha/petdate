import { Router } from 'express';
import { dbService } from '../db';
import { parsePositiveIntId } from './parse-positive-int-id';

export const sectionsRouter = Router();

sectionsRouter.get('/', (_req, res) => {
  res.json(dbService.listSections());
});

sectionsRouter.get('/:id', (req, res) => {
  const id = parsePositiveIntId(req.params.id);
  if (id == null) {
    res.status(400).json({ error: 'شناسه سکشن نامعتبر است' });
    return;
  }
  const section = dbService.getSection(id);
  if (!section) {
    res.status(404).json({ error: 'سکشن پیدا نشد' });
    return;
  }
  res.json(section);
});

sectionsRouter.post('/', (req, res) => {
  const { name, description, city } = req.body;
  if (!name) {
    res.status(400).json({ error: 'نام سکشن الزامی است' });
    return;
  }
  const section = dbService.createSection({ name, description, city });
  res.status(201).json(section);
});

sectionsRouter.get('/:id/games', (req, res) => {
  const sectionId = parsePositiveIntId(req.params.id);
  if (sectionId == null) {
    res.status(400).json({ error: 'شناسه سکشن نامعتبر است' });
    return;
  }
  const section = dbService.getSection(sectionId);
  if (!section) {
    res.status(404).json({ error: 'سکشن پیدا نشد' });
    return;
  }
  // Empty list is success — never 500 when a section has no open games.
  const games = dbService.listGames({ sectionId, status: 'open' });
  res.json({ section, games: Array.isArray(games) ? games : [] });
});
