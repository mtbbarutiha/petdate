/**
 * Admin pet-lover reviews moderation — /api/admin/pet-lover-reviews/*
 */
import { Router } from 'express';
import { requirePermission } from '../admin-auth';
import {
  deletePetLoverReview,
  getPetLoverReviewById,
  listAdminPetLoverReviews,
  setPetLoverReviewStatus,
} from '../pet-lover-reviews-service';
import type { PetLoverReviewStatus } from '@petdate/shared';

export const petLoverReviewsAdminRouter = Router();

petLoverReviewsAdminRouter.use(requirePermission('content.write'));

petLoverReviewsAdminRouter.get('/', (req, res) => {
  const raw = typeof req.query.status === 'string' ? req.query.status : 'all';
  const status = (
    raw === 'pending' || raw === 'approved' || raw === 'rejected' || raw === 'all'
      ? raw
      : 'all'
  ) as PetLoverReviewStatus | 'all';
  const limit = req.query.limit ? Number(req.query.limit) : 50;
  const offset = req.query.offset ? Number(req.query.offset) : 0;
  const data = listAdminPetLoverReviews({
    status,
    limit: Number.isFinite(limit) ? limit : 50,
    offset: Number.isFinite(offset) ? offset : 0,
  });
  res.json(data);
});

petLoverReviewsAdminRouter.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id < 1) {
    res.status(400).json({ error: 'شناسه نامعتبر' });
    return;
  }
  const review = getPetLoverReviewById(id);
  if (!review) {
    res.status(404).json({ error: 'نظر پیدا نشد' });
    return;
  }
  res.json({ review });
});

petLoverReviewsAdminRouter.post('/:id/approve', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id < 1) {
    res.status(400).json({ error: 'شناسه نامعتبر' });
    return;
  }
  const reviewedBy = req.adminActor?.username || req.adminActor?.displayName || 'admin';
  const review = setPetLoverReviewStatus(id, 'approved', { reviewedBy });
  if (!review) {
    res.status(404).json({ error: 'نظر پیدا نشد' });
    return;
  }
  res.json({ review });
});

petLoverReviewsAdminRouter.post('/:id/reject', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id < 1) {
    res.status(400).json({ error: 'شناسه نامعتبر' });
    return;
  }
  const note =
    typeof req.body?.note === 'string'
      ? req.body.note
      : typeof req.body?.adminNote === 'string'
        ? req.body.adminNote
        : undefined;
  const reviewedBy = req.adminActor?.username || req.adminActor?.displayName || 'admin';
  const review = setPetLoverReviewStatus(id, 'rejected', { adminNote: note, reviewedBy });
  if (!review) {
    res.status(404).json({ error: 'نظر پیدا نشد' });
    return;
  }
  res.json({ review });
});

petLoverReviewsAdminRouter.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id < 1) {
    res.status(400).json({ error: 'شناسه نامعتبر' });
    return;
  }
  if (!deletePetLoverReview(id)) {
    res.status(404).json({ error: 'نظر پیدا نشد' });
    return;
  }
  res.json({ ok: true });
});
